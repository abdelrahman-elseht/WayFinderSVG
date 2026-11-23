"""Floor-isolated publication transactions shared by the admin workers."""
import contextlib
import hashlib
import json
import os
import math
from pathlib import Path
import uuid


CAPABILITIES = {'nodeMoves': True, 'nodeDeletion': True, 'edgeAddition': True,
                'nodeMerge': True, 'sourceEdits': True, 'areaMasking': True,
                'edgeGeometryEditing': True, 'nodeAddition': True,
                'roomEndpointBinding': True, 'immediatePublish': True}

AUTHORING_DEFAULTS = {'navigableAreaEdits': [], 'addedNodes': [],
                      'roomEntryBindings': [], 'edgeGeometryEdits': {}}


def authoring_edits(payload):
    """Missing optional fields are legacy clients, not a request to replay history."""
    result = {}
    for key, default in AUTHORING_DEFAULTS.items():
        value = payload.get(key, default)
        expected = dict if isinstance(default, dict) else list
        if not isinstance(value, expected) or len(value) > (500 if key == 'navigableAreaEdits' else 1000):
            raise ValueError('Invalid ' + key + ' collection')
        result[key] = json.loads(json.dumps(value, allow_nan=False))
    return result


def pending_node_ids(payload):
    additions = authoring_edits(payload)['addedNodes']
    if any(not isinstance(node, dict) or not isinstance(node.get('id'), str) for node in additions):
        raise ValueError('Added graph nodes require string identities')
    return {node['id'] for node in additions}


def authoring_source_references(root, floor, spine_records):
    floor_id = floor['floor']['id']
    references = {reference for item in spine_records for reference in item.get('sourceReferences', [])}
    for room in floor.get('rooms', []):
        references.update(item['source'] for item in room.get('provenance', [])
                          if isinstance(item.get('source'), str))
    base = f'maps/B03/{floor_id}'
    for name in ('master.svg', 'alignment.json'):
        if (root / base / name).exists():
            references.add(base + '/' + name)
    for path in sorted((root / base / 'source').glob('*.json')):
        source = json.loads(path.read_text('utf-8'))
        for collection in ('paths', 'texts'):
            references.update(f'{base}/source/{path.name}#{item["id"]}'
                              for item in source.get(collection, []) if isinstance(item.get('id'), str))
    return sorted(references)


def transition_nodes(root, floor_id):
    other_floor = '01' if floor_id == 'GF' else 'GF'
    publication = read_snapshot(root, other_floor)
    if publication:
        other_graph = publication['graph']
    else:
        canonical = root / f'data/buildings/B03/{other_floor}.graph.json'
        other_graph = json.loads(canonical.read_text('utf-8')) if canonical.exists() else {'nodes': []}
    return [node for node in other_graph.get('nodes', []) if node.get('type') in ('escalator', 'elevator')]


def transition_candidates(root, floor_id, graph):
    other_nodes = transition_nodes(root, floor_id)
    all_nodes = [*graph.get('nodes', []), *other_nodes]
    counts = {}
    for node in all_nodes:
        transition_id = node.get('transitionId')
        if transition_id:
            counts[transition_id] = counts.get(transition_id, 0) + 1
    required = ('transitionId', 'transitionName', 'type', 'transitionAccessibility', 'transitionRestriction', 'floorId', 'id')
    return [{key: node[key] for key in required}
            for node in other_nodes
            if node.get('transitionId')
            and all(key in node for key in required)
            and counts.get(node['transitionId']) == 1]


def _review(item, context):
    reference, note = item.get('sourceReference'), item.get('note')
    if (not isinstance(reference, str) or not reference.strip() or
            not isinstance(note, str) or not 1 <= len(note.strip()) <= 2000):
        raise ValueError('Authoring requires a floor source reference and review note of 1..2000 characters')
    if context is None or reference not in context['sourceReferences']:
        raise ValueError('Authoring sourceReference must identify supplied evidence for this floor')
    return {'kind': 'admin-drawing-review', 'sourceReference': reference,
            'note': note.strip(), 'status': 'candidate', 'accessibility': 'unknown'}


def _point(value, context=None):
    if (not isinstance(value, list) or len(value) != 2 or
            any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in value)):
        raise ValueError('Authoring coordinates must be finite points')
    if context is not None:
        x, y, width, height = context['floor']['floor']['viewBox']
        if not (x <= value[0] <= x + width and y <= value[1] <= y + height):
            raise ValueError('Authoring coordinates must lie within the floor source frame')
    return value


def _exclusions(graph, room_records, context=None):
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    polygons = []
    for room in room_records:
        ring = room.get('polygon') or (room.get('displayFootprint') or {}).get('polygon')
        if ring and room.get('category') != 'circulation':
            polygons.append(Polygon(ring))
    polygons.extend(Polygon(ring) for ring in (context or {}).get('exclusions', []))
    originals = graph.get('adminAuthoring', {}).get('originalNavigableAreas', graph.get('navigableAreas', []))
    domain = unary_union([Polygon(ring) for ring in originals])
    for polygon in _polygon_parts(domain):
        polygons.extend(Polygon(ring) for ring in polygon.interiors)
    return polygons


def _polygon_parts(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [polygon for part in getattr(geometry, 'geoms', []) for polygon in _polygon_parts(part)]


def _simple_rings(domain):
    """The v1 ring union cannot encode holes: decompose, never drop interiors."""
    from shapely.ops import triangulate
    rings = []
    for polygon in _polygon_parts(domain):
        pieces = [polygon] if not polygon.interiors else [piece
            for triangle in triangulate(polygon)
            for piece in _polygon_parts(triangle.intersection(polygon))]
        for piece in pieces:
            if piece.interiors:
                rings.extend(_simple_rings(piece))
            elif piece.area > 1e-9:
                rings.append([[float(x), float(y)] for x, y in list(piece.exterior.coords)[:-1]])
    return sorted(rings, key=lambda ring: json.dumps(ring, separators=(',', ':')))


def authored_overlay(graph, floor, payload, moves, deleted, additions, merges, *,
                     protected_ids=(), source_references=(), exclusions=(), known_transition_nodes=()):
    edits = authoring_edits(payload)
    context = {'floor': floor, 'sourceReferences': set(source_references), 'exclusions': exclusions,
               'transitionNodes': known_transition_nodes}
    result, excluded = edited_graph(
        graph, moves, deleted, additions, protected_ids=protected_ids, pending_merges=merges,
        added_nodes=edits['addedNodes'], area_edits=edits['navigableAreaEdits'],
        edge_geometry_edits=edits['edgeGeometryEdits'], room_records=floor.get('rooms', []),
        authoring_context=context)
    result, merge = merge_graph_nodes(result, merges, protected_ids=protected_ids, original_graph=graph)
    authored = any(edits.values())
    if authored:
        from shapely.geometry import LineString, Polygon
        from shapely.ops import unary_union
        domain = unary_union([Polygon(ring) for ring in result['navigableAreas']])
        walls = [LineString(wall) for wall in result.get('walls', [])]
        obstacles = _exclusions(graph, floor.get('rooms', []), context)
        old_edges = {edge['id']: edge for edge in graph['edges']}
        old_domain = unary_union([Polygon(ring) for ring in graph.get('navigableAreas', [])])
        changed_area = domain.symmetric_difference(old_domain)
        for edge in result['edges']:
            line = LineString(edge['geometry'])
            original = old_edges.get(edge['id'])
            changed = original is None or edge['geometry'] != original['geometry']
            if changed or (not changed_area.is_empty and line.intersects(changed_area)):
                if not domain.covers(line):
                    raise ValueError('Authored connection leaves navigable-area evidence: ' + edge['id'])
                if any(line.intersects(wall) for wall in walls):
                    raise ValueError('Authored connection touches a supplied wall: ' + edge['id'])
                if any(line.relate_pattern(solid, 'T********') for solid in obstacles):
                    raise ValueError('Authored connection crosses a room or void exclusion: ' + edge['id'])
        result['status'] = 'candidate'
    bound_floor = apply_room_bindings(floor, result, edits['roomEntryBindings'], context=context)
    assert_graph(result, floor['floor']['id'])
    return result, excluded, bound_floor, merge, edits


def validate_authoring_candidate(saved, graph, floor, *, protected_ids=(),
                                source_references=(), exclusions=(), known_transition_nodes=()):
    """A serialized draft has the same geometry/identity boundary as a live edit."""
    return authored_overlay(
        graph, floor, saved, saved.get('nodeMoves', {}), saved.get('deletedNodes', []),
        saved.get('addedEdges', []), saved.get('nodeMerges', {}),
        protected_ids=protected_ids, source_references=source_references, exclusions=exclusions,
        known_transition_nodes=known_transition_nodes)


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def snapshot_path(root, floor_id):
    if floor_id not in ('GF', '01'):
        raise ValueError('Unsupported navigation floor')
    configured = os.environ.get('WAYFINDING_NAVIGATION_STORE')
    if configured:
        target = Path(configured).resolve()
        return target if floor_id == 'GF' else Path(str(target) + '.01')
    target = root / '.data/navigation/B03-GF.json'
    return target if floor_id == 'GF' else Path(str(target) + '.01')


def read_snapshot(root, floor_id):
    target = snapshot_path(root, floor_id)
    if not target.exists():
        return None
    value = json.loads(target.read_text('utf-8'))
    if value.get('schemaVersion') != 1 or value.get('floorId') != floor_id or value.get('buildingId') != 'B03':
        raise ValueError('Navigation publication identity mismatch')
    if not isinstance(value.get('revision'), str) or not isinstance(value.get('config'), dict) or not isinstance(value.get('graph'), dict):
        raise ValueError('Malformed navigation publication')
    return value


def publication(root, floor_id):
    value = read_snapshot(root, floor_id)
    return {'floorId': floor_id, 'published': value is not None,
            'revision': value['revision'] if value else None, 'reloadRequired': True}


def atomic(target, data):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


@contextlib.contextmanager
def locked(root, floor_id):
    """OS locks release on worker termination, including interrupted saves."""
    target = snapshot_path(root, floor_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    with Path(str(target) + '.lock').open('a+b') as stream:
        if os.name == 'nt':
            import msvcrt
            stream.seek(0)
            if not stream.read(1):
                stream.write(b'0')
                stream.flush()
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            recover(root, floor_id)
            yield
        finally:
            if os.name == 'nt':
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def recover(root, floor_id):
    target = snapshot_path(root, floor_id)
    journal = Path(str(target) + '.recovery.json')
    if not journal.exists():
        return
    record = json.loads(journal.read_text('utf-8'))
    # The snapshot is the commit marker and is always replaced last.
    committed = target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == record['commitDigest']
    if not committed:
        for entry in record['entries']:
            destination = Path(entry['target'])
            if entry['backup'] is None:
                destination.unlink(missing_ok=True)
            else:
                atomic(destination, Path(entry['backup']).read_bytes())
    journal.unlink()


def commit(root, floor_id, store, writes, snapshot):
    """Caller holds locked(); replace the public snapshot only after source writes."""
    if snapshot.get('floorId') != floor_id or snapshot.get('buildingId') != 'B03':
        raise ValueError('Navigation publication identity mismatch')
    assert_graph(snapshot['graph'], floor_id)
    target = snapshot_path(root, floor_id)
    snapshot_bytes = encoded(snapshot)
    backup_id = 'backup-' + uuid.uuid4().hex
    backup_root = Path(str(target) + '.backups') / backup_id
    entries = []
    for index, (destination, _) in enumerate([*writes, (target, snapshot_bytes)]):
        backup = backup_root / f'{index}.bin' if destination.exists() else None
        if backup is not None:
            atomic(backup, destination.read_bytes())
            if destination.is_relative_to(root):
                atomic(store / backup_id / destination.relative_to(root), destination.read_bytes())
        entries.append({'target': str(destination.resolve()),
                        'backup': str(backup.resolve()) if backup else None})
    record = {'floorId': floor_id, 'backup': backup_id, 'entries': entries,
              'commitDigest': hashlib.sha256(snapshot_bytes).hexdigest()}
    # Keep a human-readable manifest with durable backups, even after success.
    atomic(backup_root / 'manifest.json', encoded(record))
    journal = Path(str(target) + '.recovery.json')
    atomic(journal, encoded(record))
    try:
        for destination, data in writes:
            atomic(destination, data)
        atomic(target, snapshot_bytes)
    except BaseException:
        recover(root, floor_id)
        raise
    journal.unlink()
    return backup_id


def assert_graph(graph, floor_id):
    """Primitive integrity only; geometry safety is the router's separate gate."""
    nodes = graph.get('nodes')
    edges = graph.get('edges')
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError('Graph nodes and edges must be arrays')
    by_id = {}
    for node in nodes:
        key, point = node.get('id'), node.get('point')
        if not isinstance(key, str) or not key or key in by_id:
            raise ValueError('Graph node identities must be unique nonempty strings')
        if node.get('buildingId') != 'B03' or node.get('floorId') != floor_id:
            raise ValueError('Graph node belongs to another floor')
        if (not isinstance(point, list) or len(point) != 2 or
                any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in point)):
            raise ValueError('Graph nodes require finite points')
        by_id[key] = node
    edge_ids = set()
    for edge in edges:
        key, geometry = edge.get('id'), edge.get('geometry')
        if not isinstance(key, str) or not key or key in edge_ids:
            raise ValueError('Graph edge identities must be unique nonempty strings')
        edge_ids.add(key)
        start, end = by_id.get(edge.get('from')), by_id.get(edge.get('to'))
        if not start or not end or start is end or edge.get('floorId') != floor_id:
            raise ValueError('Graph edges require distinct existing same-floor endpoints')
        if not isinstance(geometry, list) or len(geometry) < 2:
            raise ValueError('Graph edge geometry must join its named endpoints')
        if any(not isinstance(point, list) or len(point) != 2 or
               any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in point)
               for point in geometry):
            raise ValueError('Graph edge geometry requires finite points')
        if math.dist(geometry[0], start['point']) > .001 or math.dist(geometry[-1], end['point']) > .001:
            raise ValueError('Graph edge geometry must join its named endpoints')
        length = sum(math.dist(a, b) for a, b in zip(geometry, geometry[1:]))
        distance = edge.get('distance')
        expected = length * graph['metersPerUnit'] if edge.get('distanceUnit') == 'meter' else length
        if (type(distance) not in (int, float) or not math.isfinite(distance) or distance <= 0 or
                abs(distance - expected) > max(.01, expected * 1e-5)):
            raise ValueError('Graph distance must agree with positive finite geometry')


def edited_graph(graph, moves, deleted, additions=(), merges=None, protected_ids=(), *,
                 pending_merges=None, added_nodes=(), area_edits=(), edge_geometry_edits=None,
                 room_records=(), authoring_context=None):
    result = json.loads(json.dumps(graph))
    result = apply_area_edits(result, area_edits, room_records, context=authoring_context)
    result = add_graph_nodes(result, added_nodes, context=authoring_context)
    removed = set(deleted)
    for node in result['nodes']:
        if node['id'] in moves:
            node['point'] = moves[node['id']]
    result['nodes'] = [node for node in result['nodes'] if node['id'] not in removed]
    edges, excluded = [], []
    for edge in result['edges']:
        if edge['from'] in removed or edge['to'] in removed:
            continue
        if edge['from'] in moves:
            edge['geometry'][0] = moves[edge['from']]
        if edge['to'] in moves:
            edge['geometry'][-1] = moves[edge['to']]
        distance = sum(math.dist(a, b) for a, b in zip(edge['geometry'], edge['geometry'][1:]))
        if distance <= 0 or not math.isfinite(distance):
            excluded.append(edge['id'])
            continue
        edge['distance'] = distance * result['metersPerUnit'] if edge.get('distanceUnit') == 'meter' else distance
        edges.append(edge)
    result['edges'] = edges
    if edge_geometry_edits:
        result = edit_edge_geometries(result, edge_geometry_edits, original_graph=graph,
                                      authoring_context=authoring_context)
    # A pending connection wholly inside an explicitly merged junction becomes
    # a self-link. Validate the aliases first, then omit only those connections.
    if pending_merges:
        _, checked_merge = merge_graph_nodes(result, pending_merges, protected_ids=protected_ids)
        aliases = checked_merge['aliases']
        if not isinstance(additions, (list, tuple)) or len(additions) > 1000:
            raise ValueError('Invalid added-edge collection')
        additions = [edge for edge in additions if not isinstance(edge, dict) or
                     aliases.get(edge.get('from'), edge.get('from')) !=
                     aliases.get(edge.get('to'), edge.get('to')) or
                     edge.get('from') not in aliases and edge.get('to') not in aliases]
    result, _ = add_graph_edges(result, additions)
    if merges:
        result, _ = merge_graph_nodes(result, merges, protected_ids=protected_ids, original_graph=graph)
    return result, excluded


def merge_graph_nodes(graph, merges, *, protected_ids=(), check_coincidence=True, original_graph=None):
    """Rewire explicit coincident junction aliases; never infer topology from distance."""
    if not isinstance(merges, dict) or len(merges) > 1000 or any(
            not isinstance(key, str) or not isinstance(value, str) for key, value in merges.items()):
        raise ValueError('Invalid node merge collection')
    result = json.loads(json.dumps(graph))
    nodes = {node['id']: node for node in result['nodes']}
    original_edges = {edge['id']: edge for edge in (original_graph or graph)['edges']}
    aliases, protected = {}, set(protected_ids)
    for key in sorted(merges):
        target, seen = key, set()
        while target in merges:
            if target in seen:
                raise ValueError('Node merges cannot contain cycles')
            seen.add(target)
            target = merges[target]
        node, survivor = nodes.get(key), nodes.get(target)
        if (not node or not survivor or key == target or
                node.get('floorId') != survivor.get('floorId') or
                node.get('buildingId') != survivor.get('buildingId')):
            raise ValueError('Merge requires distinct existing same-floor junctions')
        if any(item.get('type') != 'junction' or item.get('roomId') or item['id'] in protected or
               item.get('reason') in ('door', 'approach', 'transition') for item in (node, survivor)):
            raise ValueError('Room, approach and transition identities cannot be merged')
        if ({k: v for k, v in node.items() if k not in ('id', 'point')} !=
                {k: v for k, v in survivor.items() if k not in ('id', 'point')}):
            raise ValueError('Junction metadata or evidence differs; merge would discard an identity')
        if check_coincidence and math.dist(node['point'], survivor['point']) > .5:
            raise ValueError('Move the selected junctions on top of each other before merging')
        aliases[key] = target
    edges, signatures, edge_ids, affected_ids, removed = [], {}, {}, set(), []
    for original in result['edges']:
        edge = json.loads(json.dumps(original))
        edge['from'] = aliases.get(edge['from'], edge['from'])
        edge['to'] = aliases.get(edge['to'], edge['to'])
        affected = edge['from'] != original['from'] or edge['to'] != original['to']
        if affected and edge['from'] == edge['to']:
            removed.append(original)
            continue
        if affected:
            edge['geometry'][0] = nodes[edge['from']]['point']
            edge['geometry'][-1] = nodes[edge['to']]['point']
            length = sum(math.dist(a, b) for a, b in zip(edge['geometry'], edge['geometry'][1:]))
            edge['distance'] = length * graph['metersPerUnit'] if edge.get('distanceUnit') == 'meter' else length
            if edge['geometry'] != original_edges.get(edge['id'], original)['geometry']:
                from shapely.geometry import LineString, Polygon
                from shapely.ops import unary_union
                line = LineString(edge['geometry'])
                areas = graph.get('navigableAreas') or []
                if not areas or line.length <= 0 or not unary_union([Polygon(area) for area in areas]).covers(line):
                    raise ValueError('Merged connection segment is not covered by navigable-area evidence')
                if any(line.intersects(LineString(wall)) for wall in graph.get('walls', [])):
                    raise ValueError('Merged connection segment touches a supplied wall')
        normalized = {key: value for key, value in edge.items() if key != 'id'}
        if edge.get('bidirectional') and edge['from'] > edge['to']:
            normalized.update({'from': edge['to'], 'to': edge['from'], 'geometry': list(reversed(edge['geometry']))})
        signature = json.dumps(normalized, sort_keys=True, separators=(',', ':'))
        duplicate = signatures.get(signature)
        if duplicate is not None and (affected or duplicate in affected_ids):
            edge_ids[edge['id']] = duplicate
            removed.append(original)
            continue
        edges.append(edge)
        signatures[signature] = edge['id']
        edge_ids[edge['id']] = edge['id']
        if affected:
            affected_ids.add(edge['id'])
    result['nodes'] = [node for node in result['nodes'] if node['id'] not in aliases]
    result['edges'] = edges
    return result, {'aliases': aliases, 'edgeIds': edge_ids,
                    'nodes': [node for node in graph['nodes'] if node['id'] in aliases],
                    'removedEdges': removed}


def merge_source_links(source_links, merge):
    # Retain separate evidence records and source references after deduplication.
    return [{**item, 'edgeId': merge['edgeIds'][item['edgeId']]}
            for item in source_links if item['edgeId'] in merge['edgeIds']]


def validate_merge_candidate(saved, revision, graph, protected_ids=()):
    if saved.get('revision') != revision:
        raise ValueError('Saved candidate revision changed. Reload or create a new draft before restoring.')
    merges = saved.get('nodeMerges', {})
    if merges:
        # Validate references before returning a draft that the client will render.
        live = {node['id'] for node in graph['nodes']} | pending_node_ids(saved)
        if not isinstance(merges, dict) or any(key not in live or value not in live for key, value in merges.items()):
            raise ValueError('Saved candidate merge targets are absent from the loaded graph')
        if not any(authoring_edits(saved).values()):
            edited_graph(graph, saved.get('nodeMoves', {}), saved.get('deletedNodes', []),
                         saved.get('addedEdges', []), merges=merges, protected_ids=protected_ids,
                         pending_merges=merges)


def merge_protected_ids(root, floor_id, floor, config):
    protected = {room['doorNodeId'] for room in floor.get('rooms', []) if room.get('doorNodeId')}
    protected.update(kiosk['nodeId'] for kiosk in floor.get('kiosks', []) if kiosk.get('nodeId'))
    protected.update(config.get('junctionCleanupProtectedNodeIds', []))
    configured = os.environ.get('WAYFINDING_TRANSITION_STORE')
    target = Path(configured).resolve() if configured else root / '.data/transitions/B03.v1.json'
    if target.exists():
        transitions = json.loads(target.read_text('utf-8'))
        if transitions.get('version') != 1 or transitions.get('buildingId') != 'B03' or not isinstance(transitions.get('transitions'), list):
            raise ValueError('Invalid transition protection config')
        for transition in transitions['transitions']:
            for side in ('from', 'to'):
                endpoint = transition[side]
                if endpoint['floorId'] == floor_id:
                    protected.add(endpoint['attachmentNodeId'])
    return protected


def add_graph_edges(graph, additions):
    """Add explicitly authored straight candidate links only when supplied geometry supports them."""
    if not isinstance(additions, (list, tuple)) or len(additions) > 1000:
        raise ValueError('Invalid added-edge collection')
    result = json.loads(json.dumps(graph))
    nodes = {node['id']: node for node in result.get('nodes', [])}
    edges = list(result.get('edges', []))
    edge_ids = {edge['id'] for edge in edges}
    connected = {frozenset((edge['from'], edge['to'])) for edge in edges}
    areas = result.get('navigableAreas') or []
    if additions and not areas:
        raise ValueError('Cannot connect nodes without navigable-area evidence')
    if additions:
        from shapely.geometry import LineString, Polygon
        from shapely.ops import unary_union
        try:
            domain = unary_union([Polygon(area) for area in areas])
        except Exception as error:
            raise ValueError('Navigable-area evidence is invalid') from error
        walls = [LineString(wall) for wall in result.get('walls', [])]
    for addition in additions:
        if not isinstance(addition, dict):
            raise ValueError('Added edges must be objects')
        edge_id, start_id, end_id = (addition.get(key) for key in ('id', 'from', 'to'))
        if not all(isinstance(value, str) and value for value in (edge_id, start_id, end_id)):
            raise ValueError('Added edges require an ID and two node IDs')
        if (edge_id in edge_ids or start_id == end_id or start_id not in nodes or end_id not in nodes or
                nodes[start_id].get('floorId') != nodes[end_id].get('floorId') or
                addition.get('floorId') != nodes[start_id].get('floorId')):
            raise ValueError('Added edges require unique IDs and distinct existing same-floor nodes')
        if frozenset((start_id, end_id)) in connected:
            raise ValueError('These nodes are already connected')
        if not edge_id.startswith(f"B03-{addition['floorId']}-admin-"):
            raise ValueError('Added edge ID must use the floor-scoped admin prefix')
        geometry = [nodes[start_id]['point'], nodes[end_id]['point']]
        line = LineString(geometry)
        if line.length <= 0 or not domain.covers(line):
            raise ValueError('Connection segment is not covered by navigable-area evidence')
        if any(line.intersects(wall) for wall in walls):
            raise ValueError('Connection segment touches a supplied wall')
        edge = {'id': edge_id, 'from': start_id, 'to': end_id,
                'floorId': addition['floorId'], 'pathType': 'corridor',
                'distance': float(line.length), 'distanceUnit': 'map-unit',
                'accessibility': 'unknown', 'restriction': 'unknown',
                'status': 'candidate', 'bidirectional': True, 'geometry': geometry}
        edges.append(edge)
        edge_ids.add(edge_id)
        connected.add(frozenset((start_id, end_id)))
    result['edges'] = edges
    return result, result['edges'][-len(additions):] if additions else []


def apply_area_edits(graph, edits, room_records=(), *, context=None):
    if not isinstance(edits, (list, tuple)) or len(edits) > 500:
        raise ValueError('Invalid navigable-area edit collection')
    if not edits:
        return graph
    graph = json.loads(json.dumps(graph))
    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union
    areas = graph.get('navigableAreas') or []
    if not areas:
        raise ValueError('Cannot edit navigable areas without existing area evidence')
    domain = unary_union([Polygon(ring) for ring in areas])
    walls = [LineString(wall) for wall in graph.get('walls', [])]
    rooms = _exclusions(graph, room_records, context)
    history = graph.setdefault('adminAuthoring', {
        'originalNavigableAreas': json.loads(json.dumps(areas)), 'navigableAreaEdits': [],
        'addedNodes': [], 'edgeGeometryEdits': []})
    supported = unary_union([Polygon(ring) for ring in history['originalNavigableAreas']])
    seen = {item['id'] for item in history['navigableAreaEdits']}
    for item in edits:
        if not isinstance(item, dict) or item.get('operation') not in ('add', 'subtract'):
            raise ValueError('Navigable-area edits require add or subtract operations')
        polygon_points = item.get('polygon')
        if (not isinstance(item.get('id'), str) or not item['id'] or item['id'] in seen or
                not isinstance(polygon_points, list) or not 3 <= len(polygon_points) <= 256):
            raise ValueError('Navigable-area edits require a polygon, source reference and review note')
        review = _review(item, context)
        for point in polygon_points:
            _point(point, context)
        polygon = Polygon(polygon_points)
        if not polygon.is_valid or polygon.area <= 0:
            raise ValueError('Navigable-area mask must be a valid, non-empty polygon')
        if item['operation'] == 'add':
            if not supported.covers(polygon):
                raise ValueError('Added walkable mask exceeds original supported circulation evidence; '
                                 'no enclosing source-derived building/circulation boundary is supplied')
            if any(polygon.intersects(wall) for wall in walls):
                raise ValueError('Added walkable mask contacts a supplied wall')
            if any(polygon.intersects(room) for room in rooms):
                raise ValueError('Added walkable mask overlaps a supplied room or void exclusion')
            domain = domain.union(polygon)
        else:
            domain = domain.difference(polygon)
        seen.add(item['id'])
        history['navigableAreaEdits'].append({**json.loads(json.dumps(item)), 'review': review})
    rings = _simple_rings(domain)
    if not rings:
        raise ValueError('Navigable-area edits cannot remove all supported walking area')
    graph['navigableAreas'] = rings
    return graph


def add_graph_nodes(graph, additions, *, context=None):
    if not isinstance(additions, (list, tuple)) or len(additions) > 1000:
        raise ValueError('Invalid added-node collection')
    result = json.loads(json.dumps(graph))
    ids = {node['id'] for node in result.get('nodes', [])}
    areas = result.get('navigableAreas') or []
    if additions and not areas:
        raise ValueError('Cannot place graph nodes without navigable-area evidence')
    from shapely.geometry import Point as ShapePoint, Polygon
    from shapely.ops import unary_union
    domain = unary_union([Polygon(area) for area in areas]) if areas else None
    rooms = {room['id']: room for room in (context or {}).get('floor', {}).get('rooms', [])}
    solids = _exclusions(graph, rooms.values(), context) if additions else []
    walls = graph.get('walls', [])
    for node in additions:
        if not isinstance(node, dict):
            raise ValueError('Added graph nodes must be objects')
        node_id, point = node.get('id'), node.get('point')
        kind, room_id = node.get('type'), node.get('roomId')
        transition = kind in ('escalator', 'elevator')
        if (not isinstance(node_id, str) or not node_id.startswith('B03-' + str(node.get('floorId')) + '-admin-node-')
                or node_id in ids or node.get('floorId') not in ('GF', '01')
                or node.get('buildingId') != 'B03' or kind not in ('junction', 'entrance', 'escalator', 'elevator')
                or node.get('status') != 'candidate'
                or not isinstance(point, list) or len(point) != 2
                or any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in point)):
            raise ValueError('Added graph node has invalid identity, type, evidence or point')
        if transition:
            if (not isinstance(node.get('transitionId'), str) or not node['transitionId'].startswith('B03-transition-')
                    or not isinstance(node.get('transitionName'), str) or not node['transitionName'].strip()
                    or node.get('transitionAccessibility') not in ('confirmed', 'inaccessible', 'unknown')
                    or node.get('transitionRestriction') not in ('open', 'closed', 'unknown')
                    or room_id is not None):
                raise ValueError('Escalator and elevator landings require a transition identity, name, access and restriction status')
            linked = [existing for existing in [*result['nodes'], *(context or {}).get('transitionNodes', [])]
                      if existing.get('transitionId') == node['transitionId']]
            if len(linked) > 1:
                raise ValueError('A vertical transition can have only one landing per floor')
            if linked:
                other = linked[0]
                if (other.get('floorId') == node['floorId'] or other.get('type') != kind
                        or other.get('transitionName') != node['transitionName']
                        or other.get('transitionAccessibility') != node['transitionAccessibility']
                        or other.get('transitionRestriction') != node['transitionRestriction']):
                    raise ValueError('The paired vertical landing must match its opposite-floor type, name, access and status')
        elif any(node.get(key) is not None for key in ('transitionId', 'transitionName', 'transitionAccessibility', 'transitionRestriction')):
            raise ValueError('Transition metadata requires an escalator or elevator node')
        if context is None or node['floorId'] != context['floor']['floor']['id']:
            raise ValueError('Added graph nodes must belong to the loaded floor')
        review = _review(node, context)
        _point(point, context)
        location = ShapePoint(point)
        if not domain.covers(location):
            raise ValueError('Added graph nodes must lie within supported navigable-area evidence')
        from shapely.geometry import LineString
        if any(location.intersects(LineString(wall)) for wall in walls):
            raise ValueError('Added graph node touches a supplied wall')
        if any(solid.contains(location) for solid in solids):
            raise ValueError('Added graph node lies inside a room or void exclusion')
        if kind == 'junction' and room_id is not None:
            raise ValueError('A junction must be unbound and lie within supported navigable-area evidence')
        if kind == 'entrance' and room_id is not None and (
                not isinstance(room_id, str) or room_id not in rooms or
                rooms[room_id].get('floorId') != node['floorId']):
            raise ValueError('A room-entry node must be bound to a selected room')
        ids.add(node_id)
        persisted = {key: node[key] for key in ('id', 'buildingId', 'floorId', 'point', 'type', 'status')}
        if transition:
            persisted.update({key: node[key] for key in ('transitionId', 'transitionName', 'transitionAccessibility', 'transitionRestriction')})
        if room_id is not None:
            persisted['roomId'] = room_id
        persisted['adminReview'] = review
        result['nodes'].append(persisted)
        history = result.setdefault('adminAuthoring', {
            'originalNavigableAreas': json.loads(json.dumps(areas)), 'navigableAreaEdits': [],
            'addedNodes': [], 'edgeGeometryEdits': []})
        history['addedNodes'].append(json.loads(json.dumps(persisted)))
    return result


def edit_edge_geometries(graph, edits, *, original_graph=None, authoring_context=None):
    if not isinstance(edits, dict) or len(edits) > 1000:
        raise ValueError('Invalid edge-geometry edit collection')
    result = json.loads(json.dumps(graph))
    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union
    nodes = {node['id']: node for node in result['nodes']}
    areas = result.get('navigableAreas') or []
    if edits and not areas:
        raise ValueError('Cannot edit navigation edges without navigable-area evidence')
    domain = unary_union([Polygon(area) for area in areas]) if areas else None
    walls = [LineString(wall) for wall in result.get('walls', [])]
    found = set()
    originals = {edge['id']: edge for edge in (original_graph or graph)['edges']}
    for edge in result['edges']:
        if edge['id'] not in edits:
            continue
        request = edits[edge['id']]
        if not isinstance(request, dict) or not isinstance(request.get('geometry'), list):
            raise ValueError('Edited edge geometry requires geometry, sourceReference and review note')
        review = _review(request, authoring_context)
        points = request['geometry']
        found.add(edge['id'])
        if (not isinstance(points, list) or not 2 <= len(points) <= 256 or
                any(not isinstance(point, list) or len(point) != 2 or
                    any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in point)
                    for point in points)):
            raise ValueError('Edited edge geometry requires finite points')
        for point in points:
            _point(point, authoring_context if (authoring_context or {}).get('floor') else None)
        if points[0] != nodes[edge['from']]['point'] or points[-1] != nodes[edge['to']]['point']:
            raise ValueError('Edited edge endpoints must remain attached to their graph nodes')
        line = LineString(points)
        if line.length <= 0 or not domain.covers(line):
            raise ValueError('Edited navigation edge leaves navigable-area evidence')
        if any(line.intersects(wall) for wall in walls):
            raise ValueError('Edited navigation edge touches a supplied wall')
        if points != edge['geometry']:
            history = result.setdefault('adminAuthoring', {
                'originalNavigableAreas': json.loads(json.dumps(areas)), 'navigableAreaEdits': [],
                'addedNodes': [], 'edgeGeometryEdits': []})
            existing = next((item for item in history['edgeGeometryEdits']
                             if item.get('edgeId') == edge['id']), None)
            record = {'edgeId': edge['id'], 'before': json.loads(json.dumps(
                existing['before'] if existing else originals[edge['id']])),
                'geometry': json.loads(json.dumps(points)), 'status': 'candidate',
                'kind': 'admin-drawing-review', 'accessibility': 'unknown', 'review': review}
            if existing:
                history['edgeGeometryEdits'][history['edgeGeometryEdits'].index(existing)] = record
            else:
                history['edgeGeometryEdits'].append(record)
            edge['status'] = 'candidate'
            edge['accessibility'] = 'unknown'
        edge['geometry'] = points
        length = float(line.length)
        edge['distance'] = length * result['metersPerUnit'] if edge['distanceUnit'] == 'meter' else length
    if found != set(edits):
        raise ValueError('Edge-geometry edit references a missing edge')
    return result


def apply_room_bindings(floor, graph, bindings, *, context=None):
    if not isinstance(bindings, (list, tuple)) or len(bindings) > 1000:
        raise ValueError('Invalid room endpoint binding collection')
    result = json.loads(json.dumps(floor))
    rooms = {room['id']: room for room in result['rooms']}
    nodes = {node['id']: node for node in graph['nodes']}
    seen = set()
    # Deletions may intentionally remove a former entry. Never keep a dangling
    # semantic endpoint or silently substitute a nearby unreviewed junction.
    for room in result['rooms']:
        if room.get('doorNodeId') and room['doorNodeId'] not in nodes:
            room['doorNodeId'] = None
    for kiosk in result.get('kiosks', []):
        if kiosk.get('nodeId') and kiosk['nodeId'] not in nodes:
            kiosk.update({'nodeId': None, 'status': 'unknown'})
    for binding in bindings:
        if not isinstance(binding, dict):
            raise ValueError('Room endpoint bindings must be objects')
        room_id, node_id = binding.get('roomId'), binding.get('nodeId')
        room, node = rooms.get(room_id), nodes.get(node_id)
        if (not room or not node or room_id in seen or node['floorId'] != room['floorId']
                or node.get('roomId') not in (None, room_id) or node['type'] not in ('door', 'entrance')):
            raise ValueError('A room endpoint must reference a same-floor candidate entry node bound to that room')
        if node.get('status') != 'candidate':
            raise ValueError('Administrator-created room endpoints must remain candidate')
        review = _review(binding, context)
        # An existing source entry can be reviewed and rebound without replacing
        # its node identity or removing its original extraction evidence.
        if node.get('adminReview') is not None:
            _review(node['adminReview'], context)
        if graph.get('routingPolicy') != 'drawing-based':
            raise ValueError('Admin room approaches are supported only by drawing-based routing')
        if not any(node_id in (edge['from'], edge['to']) for edge in graph['edges']):
            raise ValueError('Connect the room entry to the graph before binding its endpoint')
        node['roomId'] = room_id
        prior = {key: json.loads(json.dumps(room[key])) for key in
                 ('doorNodeId', 'navigationNote', 'navigationPartial') if key in room}
        room.setdefault('adminEndpointHistory', []).append({
            **prior, 'doorNodeId': room.get('doorNodeId'), 'review': json.loads(json.dumps(review))})
        room['doorNodeId'] = node_id
        room['navigationPartial'] = True
        qualification = {
            'en': 'Route ends at an administrator drawing-reviewed candidate room approach; physical entry, public access and wheelchair accessibility are unverified.',
            'ar': '\u064a\u0646\u062a\u0647\u064a \u0627\u0644\u0645\u0633\u0627\u0631 \u0639\u0646\u062f \u0646\u0642\u0637\u0629 \u0627\u0642\u062a\u0631\u0627\u0628 \u0645\u0631\u0634\u062d\u0629 \u0644\u0644\u063a\u0631\u0641\u0629 \u0631\u0627\u062c\u0639\u0647\u0627 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0645\u062e\u0637\u0637\u061b \u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0641\u0639\u0644\u064a \u0623\u0648 \u0627\u0644\u0625\u062a\u0627\u062d\u0629 \u0644\u0644\u062c\u0645\u0647\u0648\u0631 \u0623\u0648 \u0644\u0644\u0643\u0631\u0627\u0633\u064a \u0627\u0644\u0645\u062a\u062d\u0631\u0643\u0629.'}
        previous_note = room.get('navigationNote') or {}
        room['navigationNote'] = {language: (previous_note.get(language, '') if text in previous_note.get(language, '')
                                           else (previous_note.get(language, '') + ' ' + text).strip())
                                  for language, text in qualification.items()}
        node['adminReview'] = review
        seen.add(room_id)
    defaults = result.get('navigationDefaults')
    if defaults and not any(room['id'] == defaults['startRoomId'] and room.get('doorNodeId')
                            for room in result['rooms']):
        result.pop('navigationDefaults')
    return result
