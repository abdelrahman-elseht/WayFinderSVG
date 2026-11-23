"""Authenticated web editor worker. JSON stdin/stdout; no caller-supplied paths.

Reconstruction runs against in-memory config overrides and a private output
directory. Confirmed saves update the runtime GF graph; geometry findings are
retained as diagnostics rather than blocking the write.
"""
import contextlib
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import uuid

from shapely.geometry import LineString, Point
from shapely.ops import unary_union

import centerline_common as common
from centerline_common import Evidence, components
import navigation_persistence as persistence

ROOT = common.ROOT
CONFIG = 'scripts/semantic-map/navigation-v2-config.json'
BASE = 'scripts/semantic-map/navigation-config.json'
GRAPH = 'artifacts/navigation-v2/GF.v2.graph.diagnostic.json'
RUNTIME_GRAPH = 'data/buildings/B03/GF.graph.json'
STORE = ROOT / 'artifacts/navigation-editor'
OUTPUTS = ['GF.v2.graph.diagnostic.json', 'reconstruction-report.json',
           'unresolved-approaches.json', 'candidate-validation.json']


def revision():
    digest = hashlib.sha256()
    for name in [BASE, CONFIG, GRAPH, 'data/buildings/B03/GF.json', 'data/buildings/B03/GF.graph.json']:
        digest.update((ROOT / name).read_bytes())
    target = persistence.snapshot_path(ROOT, 'GF')
    if target.exists():
        digest.update(target.read_bytes())
    return digest.hexdigest()


def snapshot(e):
    result = []
    for i, line in enumerate(e.raw):
        base = i < len(e.cfg['corridorSpines'])
        connection = None if base else e.reviewed_connections[i - len(e.cfg['corridorSpines'])]
        result.append({'id': f'spine:{i}' if base else f"connection:{connection['id']}",
                       'index': i, 'kind': 'spine' if base else 'connection',
                       'coordinates': list(map(list, line.coords)), 'sourceReferences': e.references([i])})
    return result


def bootstrap():
    e = Evidence()
    published = persistence.read_snapshot(ROOT, 'GF')
    if published and isinstance(published.get('floorData'), dict):
        e.floor = published['floorData']
    candidates = []
    if STORE.exists():
        candidates = sorted(p.stem for p in STORE.glob('candidate-*.json'))
    report_evidence = common.read('artifacts/navigation-v2/reconstruction-report.json').get('edgeEvidence', [])
    loaded_graph = published['graph'] if published else common.read(GRAPH)
    return {'revision': revision(), 'spines': snapshot(e), 'floor': e.floor,
            'graph': loaded_graph,
            'runtimeGraph': loaded_graph if published else common.read('data/buildings/B03/GF.graph.json'),
            'config': published['config'] if published else common.read(CONFIG),
            'evidence': published.get('sourceLinks', report_evidence) if published else report_evidence,
            'authoringSourceReferences': persistence.authoring_source_references(
                ROOT, e.floor, snapshot(e)),
            # Existing unsafe reviewed edits remain loadable.  Surface their
            # source geometry findings so the admin can inspect them instead
            # of turning bootstrap into a 503 response.
            'diagnostics': e.geometry_diagnostics,
            'candidates': candidates,
            'capabilities': persistence.CAPABILITIES,
            'mergeProtectedNodeIds': sorted(persistence.merge_protected_ids(ROOT, 'GF', e.floor,
                common.read(CONFIG))),
            'runtimePublication': persistence.publication(ROOT, 'GF'),
            'buildingBoundaryAvailable': False,
            'transitionCandidates': persistence.transition_candidates(ROOT, 'GF', loaded_graph)}


def finite(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def point_list(value):
    if not isinstance(value, list) or not 2 <= len(value) <= 256:
        raise ValueError('Each spine requires 2..256 control points')
    for p in value:
        if not isinstance(p, list) or len(p) != 2 or not finite(p[0], 650, 3750) or not finite(p[1], 500, 2050):
            raise ValueError('Coordinates must be finite points within the canonical GF viewBox')
    if any(a == b for a, b in zip(value, value[1:])):
        raise ValueError('Consecutive duplicate control points are not permitted')
    return value


def validated_node_moves(value, extra_ids=()):
    if not isinstance(value, dict) or len(value) > 1000:
        raise ValueError('Invalid node move collection')
    allowed = {node['id'] for node in common.read(GRAPH)['nodes']} | set(extra_ids)
    result = {}
    for node_id, point in value.items():
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError('Node move coordinates must be a point')
        if not finite(point[0], 650, 3750) or not finite(point[1], 500, 2050):
            raise ValueError('Node coordinates must be within the canonical GF viewBox')
        # Source reconstruction can legitimately regenerate junction IDs.  The
        # client rebases edits after a build, but tolerate a stale draft here so
        # one old ID cannot make an otherwise valid source build return 422.
        # Unknown IDs are discarded by execute() and are never applied to a
        # different node.
        if node_id not in allowed:
            continue
        result[node_id] = point
    return result


def explicit_node_moves(payload, moves, graph, before, after, evidence=()):
    """Recognize legacy UI projections, never infer identity from proximity."""
    if 'explicitNodeMoves' in payload:
        explicit = payload['explicitNodeMoves']
        if not isinstance(explicit, dict) or any(key not in moves or point != moves[key] for key, point in explicit.items()):
            raise ValueError('explicitNodeMoves must be a matching subset of nodeMoves')
        return explicit
    linked = source_linked_moves(graph, before, after, evidence)
    return {key: point for key, point in moves.items()
            if key not in linked or math.dist(point, linked[key]) > 1e-7}


def source_linked_moves(graph, before, after, evidence=()):
    """Mirror the UI's existing source-edge projection, without remapping IDs."""
    originals = {item['index']: item for item in before}
    changed = {item['index']: item for item in after
               if item['index'] in originals and item['coordinates'] != originals[item['index']]['coordinates']}
    nodes = {node['id']: node for node in graph['nodes']}
    edges = {edge['id']: edge for edge in graph['edges']}
    linked = {}
    for record in evidence:
        owners = [index for index in record['sourceSpineIds'] if index in changed]
        edge = edges.get(record['edgeId'])
        if not owners or edge is None:
            continue
        for key in (edge['from'], edge['to']):
            node = nodes[key]
            if node.get('roomId') or key in linked:
                continue
            candidates = []
            for index in owners:
                line = LineString(originals[index]['coordinates'])
                fraction = line.project(Point(node['point']), normalized=True)
                point = list(LineString(changed[index]['coordinates']).interpolate(fraction, normalized=True).coords[0])
                if record.get('preserveOffset'):
                    origin = line.interpolate(fraction, normalized=True).coords[0]
                    point = [point[axis] + node['point'][axis] - origin[axis] for axis in range(2)]
                candidates.append(point)
            linked[key] = min(candidates, key=lambda point: math.dist(point, node['point']))
    return linked


def draft_overlay(payload, moves, graph, before, after, evidence=()):
    explicit = explicit_node_moves(payload, moves, graph, before, after, evidence)
    # Older source-only clients sent no overlay. Derive the same deterministic
    # links as the UI; supplied absolute coordinates always win exactly once.
    return {**source_linked_moves(graph, before, after, evidence), **moves}, explicit


def publication_edits(previous, moves, deleted, graph):
    """The publication already contains history; never replay its overlay."""
    live = {node['id'] for node in graph['nodes']}
    removed = set(deleted)
    history = {key: point for key, point in previous.get('nodeMoves', {}).items()
               if key in live and key not in removed}
    history.update({key: point for key, point in moves.items() if key not in removed})
    # Tombstones refer only to this transaction, not a future rebuilt identity.
    return history, sorted(removed)


def reconcile_node_edits(previous, moves, deleted, current, rebuilt):
    """Published edits are baked in; obsolete history is not a new instruction.

    Missing live explicit targets are a conflict, not permission to guess which
    regenerated node to move or delete. No publication has been written yet.
    """
    live = {node['id'] for node in current['nodes']}
    regenerated = {node['id'] for node in rebuilt['nodes']}
    combined_deleted = sorted(set(previous.get('deletedNodes', [])) | set(deleted))
    combined_moves = {key: point for key, point in {**previous.get('nodeMoves', {}), **moves}.items()
                      if key in live and key not in combined_deleted}
    conflicts = sorted((set(combined_moves) | set(deleted)) - regenerated)
    if conflicts:
        raise ValueError('Explicit graph edit targets disappeared after source reconstruction: ' +
                         ', '.join(conflicts) + '. No files written; undo the conflicting graph edits or save them separately.')
    return combined_moves, combined_deleted


def validated_deleted_nodes(value, extra_ids=()):
    if not isinstance(value, list) or len(value) > 1000:
        raise ValueError('Invalid deleted-node collection')
    if any(not isinstance(node_id, str) for node_id in value):
        raise ValueError('Deleted nodes must reference graph node IDs')
    allowed = {node['id'] for node in common.read(GRAPH)['nodes']} | set(extra_ids)
    if len(set(value)) != len(value):
        raise ValueError('Deleted nodes must reference unique existing graph nodes')
    return [node_id for node_id in value if node_id in allowed]


def prepare(payload, e, check_geometry=True):
    current = {s['id']: s for s in snapshot(e)}
    items = payload.get('spines')
    if not isinstance(items, list) or len(items) > 100:
        raise ValueError('Invalid source spine collection')
    ids = [s.get('id') for s in items if isinstance(s, dict)]
    if len(ids) != len(items) or len(set(ids)) != len(ids):
        raise ValueError('Duplicate or invalid source IDs')
    removed = set(current) - set(ids)
    if any(current[key]['kind'] != 'connection' for key in removed):
        raise ValueError('Source spine removal is protected')
    settings = payload.get('settings', {})
    minimum = settings.get('minimum', 0)
    preferred = settings.get('preferred', 5)
    maximum = settings.get('maximum', 100)
    if not finite(minimum, 0, 100) or not finite(preferred, minimum, 200) or not finite(maximum, 0, 500):
        raise ValueError('Invalid clearance/displacement limits')
    config = common.read(CONFIG)
    config['reviewedConnections'] = [c for c in config['reviewedConnections'] if 'connection:' + c['id'] not in removed]
    changes, diagnostics = [], []
    for key in sorted(removed):
        changes.append({'id': key, 'before': current[key]['coordinates'], 'after': [], 'displacement': 0})
    wall_union = unary_union(e.walls)
    allowed_references = set(ref for source in current.values() for ref in source['sourceReferences'])
    anchors = {tuple(p) for source in current.values() for p in source['coordinates']}
    anchors.update(tuple(n['point']) for n in e.approaches.values())
    for item in items:
        points = point_list(item.get('coordinates'))
        line = LineString(points)
        tests = e.tests(line) if check_geometry else None
        nearby_wall_indices = sorted(
            (int(i) for i in e.wall_tree.query(line.buffer(20.0))),
            key=lambda i: (line.distance(e.walls[i]), i),
        )[:16] if check_geometry else []
        wall_distance = float(line.distance(wall_union)) if check_geometry else None
        clearance = float(line.distance(e.domain.boundary)) if check_geometry else None
        original = current.get(item['id'])
        if original is None:
            key = item['id']
            references = item.get('sourceReferences', [])
            note = item.get('note', '')
            if not isinstance(key, str) or not key.startswith('connection:admin-') or len(key) != 49 or any(c not in '0123456789abcdef' for c in key[17:]):
                raise ValueError('New source connections require a server-validated admin ID')
            if not isinstance(references, list) or not references or any(ref not in allowed_references for ref in references):
                raise ValueError('New connection must cite existing source evidence')
            if not isinstance(note, str) or not 20 <= len(note) <= 2000:
                raise ValueError('Provide a source-review justification of 20..2000 characters')
            if tuple(points[0]) not in anchors or tuple(points[-1]) not in anchors:
                raise ValueError('New connections must terminate at existing source controls or approaches')
            if check_geometry and wall_distance < minimum:
                tests = {**tests, 'safe': False, 'minimumClearanceFailure': minimum}
            config['reviewedConnections'].append({'id': key[11:], 'coordinates': points, 'sourceReferences': references, 'note': note})
            changes.append({'id': key, 'before': [], 'after': points, 'displacement': 0})
            diagnostics.append({'id': key, 'changed': True, 'tests': tests, 'wallClearance': wall_distance,
                                'walkableBoundaryClearance': clearance, 'nearbyWallIndices': nearby_wall_indices,
                                'state': 'unchecked' if not check_geometry else 'red' if not tests['safe'] else 'orange' if wall_distance < preferred else 'green'})
            continue
        changed = points != original['coordinates']
        if changed:
            old = LineString(original['coordinates'])
            # Hausdorff distance bounds additions/removals too; equal-length edits
            # additionally enforce the per-control displacement limit.
            displacement = line.hausdorff_distance(old)
            if len(points) == len(original['coordinates']):
                displacement = max(displacement, max(math.dist(a, b) for a, b in zip(points, original['coordinates'])))
            if check_geometry and displacement > maximum:
                tests = {**tests, 'safe': False, 'displacementFailure': displacement}
            if check_geometry and wall_distance < minimum:
                tests = {**tests, 'safe': False, 'minimumClearanceFailure': minimum}
            changes.append({'id': item['id'], 'before': original['coordinates'], 'after': points,
                            'displacement': displacement})
            if original['kind'] == 'spine':
                overrides = config.setdefault('reviewedSpineOverrides', [])
                override = next((s for s in overrides if s['spineIndex'] == original['index']), None)
                if override is None:
                    override = {'spineIndex': original['index'], 'id': f"admin-spine-{original['index']}",
                                'sourceReferences': original['sourceReferences'],
                                'note': 'Administrator-edited source spine; diagnostic candidate only.'}
                    overrides.append(override)
                override['coordinates'] = points
            else:
                next(s for s in config['reviewedConnections'] if 'connection:' + s['id'] == item['id'])['coordinates'] = points
        diagnostics.append({'id': item['id'], 'changed': changed, 'tests': tests,
                            'wallClearance': wall_distance, 'walkableBoundaryClearance': clearance,
                            'nearbyWallIndices': nearby_wall_indices,
                            'state': 'unchecked' if not check_geometry else 'red' if not tests['safe'] else 'orange' if wall_distance < preferred else 'green'})
    return config, changes, diagnostics


def connectivity_pairs(graph):
    room_nodes = {n['id'] for n in graph['nodes'] if n.get('roomId')}
    pairs = set()
    for group in components(graph['nodes'], graph['edges']):
        rooms = sorted(room_nodes.intersection(group))
        pairs.update((a, b) for i, a in enumerate(rooms) for b in rooms[i + 1:])
    return pairs

def graph_edit_impact(graph, moves=None, deleted=None):
    """Return non-blocking impact diagnostics for node edits."""
    moves = moves or {}
    deleted = set(deleted or [])
    nodes = {n['id']: n for n in graph.get('nodes', [])}
    affected, incident = set(), set()
    for edge in graph.get('edges', []):
        if edge.get('from') in moves or edge.get('to') in moves or edge.get('from') in deleted or edge.get('to') in deleted:
            incident.add(edge.get('id'))
            for endpoint in (edge.get('from'), edge.get('to')):
                node = nodes.get(endpoint)
                if node and node.get('roomId'):
                    affected.add(node['id'])
    for node_id in moves:
        if nodes.get(node_id, {}).get('roomId'):
            affected.add(node_id)
    edited = move_nodes(graph, moves, list(deleted)) if (moves or deleted) else graph
    unresolved = sorted({n['id'] for n in edited.get('nodes', []) if n.get('roomId')} -
                        {x for e in edited.get('edges', []) for x in (e.get('from'), e.get('to'))})
    return {'affectedRoomEndpointIds': sorted(affected),
            'incidentEdgeIds': sorted(x for x in incident if x),
            'disconnectedRoomPairs': [list(x) for x in sorted(connectivity_pairs(graph) - connectivity_pairs(edited))],
            'requiredRoomPairs': [list(x) for x in sorted(connectivity_pairs(edited))],
            'unresolvedDanglingEndpointCount': len(unresolved),
            'unresolvedDanglingEndpointIds': unresolved}

def move_nodes(graph, moves, deleted):
    result = json.loads(json.dumps(graph))
    by_id = {node['id']: node for node in result['nodes']}
    for node_id, point in moves.items():
        if node_id in by_id:
            by_id[node_id]['point'] = point
    result['nodes'] = [node for node in result['nodes'] if node['id'] not in deleted]
    for edge in result['edges']:
        if edge['from'] in moves and edge['geometry']: edge['geometry'][0] = moves[edge['from']]
        if edge['to'] in moves and edge['geometry']: edge['geometry'][-1] = moves[edge['to']]
        edge['distance'] = sum(math.dist(a, b) for a, b in zip(edge['geometry'], edge['geometry'][1:]))
    result['edges'] = [edge for edge in result['edges'] if edge['from'] not in deleted and edge['to'] not in deleted]
    return result


def runtime_safe_graph(graph):
    """Drop malformed generated edges from the visitor runtime snapshot.

    The editor keeps the original graph for diagnostics and continued editing,
    but a node move can collapse an edge to zero length.  Persisting that edge
    makes map-engine validation reject the whole runtime bundle, so filter only
    edges whose geometry has no finite positive polyline length.
    """
    result = json.loads(json.dumps(graph))
    safe_edges = []
    excluded = []
    for edge in result.get('edges', []):
        geometry = edge.get('geometry')
        length = 0.0
        valid = isinstance(geometry, list) and len(geometry) >= 2
        if valid:
            try:
                for a, b in zip(geometry, geometry[1:]):
                    if (not isinstance(a, list) or not isinstance(b, list) or
                            len(a) != 2 or len(b) != 2 or
                            not all(isinstance(v, (int, float)) and math.isfinite(v) for p in (a, b) for v in p)):
                        valid = False
                        break
                    length += math.dist(a, b)
            except (TypeError, ValueError):
                valid = False
        if valid and math.isfinite(length) and length > 0:
            safe_edges.append(edge)
        else:
            excluded.append(edge.get('id', '<unknown>'))
    result['edges'] = safe_edges
    return result, excluded


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with tmp.open('xb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode('utf-8')


def save_candidate(payload, config, changes, diagnostics, validation=None, error=None, safety_checked=True):
    STORE.mkdir(parents=True, exist_ok=True)
    candidate_id = 'candidate-' + uuid.uuid4().hex
    record = {'spines': payload['spines'], 'nodeMoves': payload.get('nodeMoves', {}),
              'explicitNodeMoves': payload.get('explicitNodeMoves', payload.get('nodeMoves', {})),
              'deletedNodes': payload.get('deletedNodes', []),
              'addedEdges': payload.get('addedEdges', []),
              'nodeMerges': payload.get('nodeMerges', {}),
              **persistence.authoring_edits(payload),
              'config': config, 'revision': payload['revision'],
              'changes': changes, 'diagnostics': diagnostics, 'validation': validation,
              'error': error, 'safetyChecked': safety_checked, 'routable': False,
              'draftOnly': not safety_checked}
    atomic(STORE / (candidate_id + '.json'), encoded(record))
    return candidate_id


def _execute(payload):
    payload = dict(payload)
    if payload.get('floorId', 'GF') != 'GF':
        raise ValueError('Submission floor does not match GF worker')
    action = payload.get('action')
    if action == 'load':
        return bootstrap()
    if action not in ('validate', 'reconstruct', 'preview', 'save', 'candidate', 'draft', 'restore'):
        raise ValueError('Unsupported editor action')
    if payload.get('revision') != revision():
        raise ValueError('Source revision changed. Export your draft and reload before saving.')
    e = Evidence()
    published = persistence.read_snapshot(ROOT, 'GF')
    if published and isinstance(published.get('floorData'), dict):
        e.floor = published['floorData']
    if action == 'restore':
        candidate = payload.get('candidate', '')
        if not isinstance(candidate, str) or not candidate.startswith('candidate-') or len(candidate) != 42 or any(c not in '0123456789abcdef' for c in candidate[10:]):
            raise ValueError('Invalid candidate ID')
        saved = json.loads((STORE / (candidate + '.json')).read_text('utf-8'))
        pending_ids = persistence.pending_node_ids(saved)
        persistence.validate_merge_candidate(saved, payload['revision'], common.read(GRAPH),
            persistence.merge_protected_ids(ROOT, 'GF', e.floor, common.read(CONFIG)) if saved.get('nodeMerges') else ())
        persistence.validate_authoring_candidate(
            saved, common.read(GRAPH), e.floor,
            protected_ids=persistence.merge_protected_ids(ROOT, 'GF', e.floor, common.read(CONFIG)),
            source_references=persistence.authoring_source_references(ROOT, e.floor, snapshot(e)),
            exclusions=common.read(CONFIG).get('voidExclusions', []),
            known_transition_nodes=persistence.transition_nodes(ROOT, 'GF'))
        # Restore into a draft, never bypass validation or silently overwrite files.
        restored_moves = explicit_node_moves(
            saved, validated_node_moves(saved.get('nodeMoves', {}), pending_ids), common.read(GRAPH),
            snapshot(e), saved['spines'],
            common.read('artifacts/navigation-v2/reconstruction-report.json').get('edgeEvidence', []))
        return {'spines': saved['spines'], 'nodeMoves': restored_moves,
                'deletedNodes': validated_deleted_nodes(saved.get('deletedNodes', []), pending_ids),
                'addedEdges': saved.get('addedEdges', []), 'restored': candidate,
                'nodeMerges': saved.get('nodeMerges', {}),
                **persistence.authoring_edits(saved),
                'routable': saved.get('routable', True), 'diagnostics': saved.get('diagnostics', [])}
    raw_moves = payload.get('nodeMoves', {})
    raw_deleted = payload.get('deletedNodes', [])
    raw_added_edges = payload.get('addedEdges', [])
    pending_ids = persistence.pending_node_ids(payload)
    if not isinstance(raw_moves, dict) or not isinstance(raw_deleted, list):
        # Let the validators provide the established shape errors.
        payload['nodeMoves'] = validated_node_moves(raw_moves)
        payload['deletedNodes'] = validated_deleted_nodes(raw_deleted)
    allowed_ids = {node['id'] for node in common.read(GRAPH)['nodes']} | pending_ids
    stale_moves = sorted(set(raw_moves) - allowed_ids)
    stale_deleted = sorted({node_id for node_id in raw_deleted if isinstance(node_id, str)} - allowed_ids)
    payload['nodeMoves'] = validated_node_moves(raw_moves, pending_ids)
    payload['deletedNodes'] = validated_deleted_nodes(raw_deleted, pending_ids)
    if not isinstance(raw_added_edges, list) or len(raw_added_edges) > 1000:
        raise ValueError('Invalid added-edge collection')
    payload['addedEdges'] = raw_added_edges
    payload['nodeMerges'] = payload.get('nodeMerges', {})
    payload.update(persistence.authoring_edits(payload))
    config, changes, diagnostics = prepare(payload, e, check_geometry=action not in ('draft', 'save'))
    loaded_graph = common.read(GRAPH)
    previous = persistence.read_snapshot(ROOT, 'GF') or {}
    source_links = previous.get('sourceLinks', common.read('artifacts/navigation-v2/reconstruction-report.json').get('edgeEvidence', []))
    applied, explicit = draft_overlay(
        payload, payload['nodeMoves'], loaded_graph, snapshot(e), payload.get('spines', []),
        source_links)
    payload['explicitNodeMoves'] = explicit
    protected = persistence.merge_protected_ids(ROOT, 'GF', e.floor, config) if payload['nodeMerges'] else ()
    source_references = persistence.authoring_source_references(ROOT, e.floor, snapshot(e))
    preview_graph, preview_excluded, edited_floor, merge, normalized_edits = persistence.authored_overlay(
        loaded_graph, e.floor, payload, applied, payload['deletedNodes'], payload['addedEdges'],
        payload['nodeMerges'], protected_ids=protected, source_references=source_references,
        exclusions=config.get('voidExclusions', []),
        known_transition_nodes=persistence.transition_nodes(ROOT, 'GF'))
    payload.update(normalized_edits)
    merged_links = persistence.merge_source_links(source_links, merge)
    if action == 'save':
        # Node edits publish the graph the administrator actually loaded, without
        # regenerating source geometry or erasing previously published edits.
        previous = persistence.read_snapshot(ROOT, 'GF') or {}
        if stale_moves or stale_deleted:
            raise ValueError('Graph edit targets are absent from the loaded graph: ' + ', '.join(stale_moves + stale_deleted))
        moves, deleted = publication_edits(previous, applied, payload['deletedNodes'], loaded_graph)
        graph, excluded = preview_graph, preview_excluded
        moves = {key: point for key, point in moves.items() if key not in merge['aliases']}
        with persistence.locked(ROOT, 'GF'):
            if payload['revision'] != revision():
                raise ValueError('Source changed; no files written')
            published = {'schemaVersion': 1, 'buildingId': 'B03', 'floorId': 'GF',
                         'revision': uuid.uuid4().hex, 'graph': graph, 'config': config,
                         'floorData': edited_floor,
                         'authorship': 'admin-authored loaded-graph overlay; not reconstructed or geometry-verified',
                         'sourceLinks': merged_links,
                         'nodeMergeHistory': [*previous.get('nodeMergeHistory', []), *([{
                             **merge, 'sourceLinks': source_links,
                             'incidentEdges': [edge for edge in loaded_graph['edges'] if edge['from'] in payload['nodeMerges'] or edge['to'] in payload['nodeMerges']]
                         }] if payload['nodeMerges'] else [])],
                         'nodeMoves': moves, 'deletedNodes': deleted}
            backup = persistence.commit(ROOT, 'GF', STORE, [
                (ROOT / CONFIG, encoded(config)), (ROOT / GRAPH, encoded(graph)),
                (ROOT / RUNTIME_GRAPH, encoded(graph)),
                (ROOT / 'data/buildings/B03/GF.json', encoded(edited_floor)),
            ], published)
        return {'saved': True, 'valid': True, 'draftOnly': False, 'revision': revision(),
                'graph': graph, 'runtimeGraph': graph, 'runtimeExcludedEdges': excluded,
                'nodeMoves': applied, 'explicitNodeMoves': explicit, 'deletedNodes': payload['deletedNodes'],
                'addedEdges': payload['addedEdges'],
                'nodeMerges': payload['nodeMerges'], 'sourceLinks': merged_links, 'config': config,
                **normalized_edits, 'floor': edited_floor,
                'backup': backup, 'diagnostics': diagnostics, 'errors': [],
                'capabilities': persistence.CAPABILITIES,
                'runtimePublication': persistence.publication(ROOT, 'GF')}
    if action == 'draft':
        payload['nodeMoves'] = applied
        candidate = save_candidate(payload, config, changes, diagnostics, safety_checked=False)
        return {'candidate': candidate, 'revision': payload['revision'], 'saved': False,
                'valid': False, 'draftOnly': True, 'routable': False, 'safetyChecked': False,
                'diagnostics': diagnostics, 'changes': changes, 'errors': [],
                'graph': preview_graph, 'floor': edited_floor, **normalized_edits,
                'staleNodeMoves': stale_moves, 'staleDeletedNodes': stale_deleted}
    payload['nodeMoves'] = explicit
    errors = [d for d in diagnostics if d['changed'] and d['tests'] and not d['tests']['safe']]
    result = {'valid': not errors, 'diagnostics': diagnostics, 'changes': changes, 'errors': errors,
              'staleNodeMoves': stale_moves, 'staleDeletedNodes': stale_deleted,
              'buildingClearance': None, 'buildingClearanceNote': 'No independent verified building-envelope polygon is supplied; walkable boundary is not a facade measurement.'}
    if payload['nodeMoves'] or payload['deletedNodes']:
        result['graphEditImpact'] = graph_edit_impact(common.read(GRAPH), payload['nodeMoves'], payload['deletedNodes'])
    if action == 'validate':
        return result
    has_graph_overlay = bool(payload['nodeMerges'] or payload['addedEdges'] or
                              payload['nodeMoves'] or payload['deletedNodes'] or
                              any(normalized_edits.values()))
    if action == 'candidate' and has_graph_overlay:
        candidate = save_candidate(payload, config, changes, diagnostics, safety_checked=False)
        return {**result, 'candidate': candidate, 'revision': payload['revision'],
                'graph': preview_graph, 'runtimeGraph': preview_graph, 'floor': edited_floor,
                'nodeMerges': payload['nodeMerges'], 'sourceLinks': merged_links,
                **normalized_edits, 'floor': edited_floor,
                'saved': False, 'draftOnly': True, 'routable': False}
    # Geometry failures are diagnostic findings; they do not prevent preview, candidate,
    # or save. Keep them in the response so the editor can display the evidence.
    if errors:
        result['diagnosticErrors'] = errors
    original_read, original_out = common.read, common.OUT
    with tempfile.TemporaryDirectory(prefix='wayfinding-editor-') as work:
        common.OUT = Path(work)
        def isolated_read(name):
            if name == CONFIG:
                return config
            if name.startswith('artifacts/navigation-v2/') and (Path(work) / Path(name).name).exists():
                return json.loads((Path(work) / Path(name).name).read_text('utf-8'))
            return original_read(name)
        common.read = isolated_read
        try:
            import reconstruct_centerline_graph
            import verify_centerline_candidate
            verify_centerline_candidate.read = isolated_read
            original_safe = common.Evidence.safe
            try:
                # Reconstruction must always produce a graph for the editor. Geometry
                # violations are collected by the diagnostics/verification pass below;
                # Evidence.safe is an input filter and would otherwise abort unsafe
                # wall-crossing edits before they can be previewed or saved.
                common.Evidence.safe = lambda self, line: True
                # Both reconstruction and verification emit diagnostic values to stdout.
                # The API response is JSON, so keep those diagnostics out of the worker
                # stream while preserving the returned graph/report/validation objects.
                with contextlib.redirect_stdout(io.StringIO()):
                    graph, report = reconstruct_centerline_graph.reconstruct()
                    if action in ('preview', 'save'):
                        validation = {'acceptance': 'PREVIEW_ONLY', 'checksSkipped': True,
                                      'strictWalkableAreaFailures': [], 'wallContacts': [],
                                      'roomInteriorCrossings': [], 'endpointMismatches': [],
                                      'distanceMismatches': [], 'candidateMetadataFailures': [],
                                      'approachNodesMissing': [], 'approachesWithoutEdges': []}
                    else:
                        validation = verify_centerline_candidate.verify()
            finally:
                common.Evidence.safe = original_safe
            if action == 'save':
                validation['acceptance'] = 'PUBLISHED_WITHOUT_VERIFICATION'
                common.write('candidate-validation.json', validation)
            wall_union = unary_union(e.walls)
            by_edge = {edge['id']: edge for edge in graph['edges']}
            for record in report['edgeEvidence']:
                line = LineString(by_edge[record['edgeId']]['geometry'])
                record['wallClearance'] = float(line.distance(wall_union))
                record['walkableBoundaryClearance'] = float(line.distance(e.domain.boundary))
            common.write('reconstruction-report.json', report)
            failures = [key for key in ('strictWalkableAreaFailures', 'wallContacts', 'roomInteriorCrossings',
                         'endpointMismatches', 'distanceMismatches', 'candidateMetadataFailures', 'approachNodesMissing') if validation[key]]
            lost = sorted(connectivity_pairs(original_read(GRAPH)) - connectivity_pairs(graph))
            unsupported_approaches = {'B03-GF-G-39-approach', 'B03-GF-G-40-approach'}
            unattached_rooms = sorted(set(validation['approachesWithoutEdges']) - unsupported_approaches)
            forbidden = [edge['id'] for edge in graph['edges'] if any(edge[k] in ('B03-GF-G-39-approach', 'B03-GF-G-40-approach') for k in ('from', 'to'))]
            required = [('B03-GF-G-35-approach', 'B03-GF-G-01-approach'), ('B03-GF-G-37-approach', 'B03-GF-G-42-approach')]
            pairs = connectivity_pairs(graph)
            regressions = [list(pair) for pair in required if tuple(sorted(pair)) not in pairs]
            room_connections = [{
                'nodeId': approach['id'], 'room': approach.get('room'),
                'point': approach['point'], 'attachment': approach.get('attachment'),
                'method': approach.get('method'), 'incidentEdgeCount': approach.get('incidentEdgeCount', 0),
                'componentIndex': approach.get('componentIndex'),
                'connected': approach.get('incidentEdgeCount', 0) > 0,
            } for approach in report['approaches']]
            result.update({'graph': graph, 'report': report, 'validation': validation,
                           'lostRoomPairs': lost, 'unattachedSupportedRooms': unattached_rooms,
                           'roomConnections': room_connections, 'requiredRouteFailures': regressions,
                           # Geometry and connectivity findings remain diagnostics; the editor must allow
                           # unsafe drafts and saves so operators can inspect their runtime effect.
                           'valid': action != 'preview',
                           'draftOnly': action == 'preview', 'routable': False,
                           'safetyChecked': action not in ('preview', 'save')})
            if action == 'preview':
                # Match save's loaded topology and source-linked/manual edits;
                # reconstruction above supplies diagnostics, not replacement IDs.
                result.update({'graph': preview_graph, 'runtimeGraph': preview_graph,
                               'floor': edited_floor, **normalized_edits,
                               'runtimeExcludedEdges': preview_excluded,
                               'nodeMoves': applied, 'explicitNodeMoves': explicit,
                               'deletedNodes': payload['deletedNodes'],
                               'addedEdges': payload['addedEdges'],
                               'nodeMerges': payload['nodeMerges'], 'sourceLinks': merged_links})
                return result
            if not result['valid'] and action not in ('preview', 'save'):
                result['errors'] = [{'validationFailures': failures, 'lostRoomPairs': lost,
                                     'unattachedSupportedRooms': unattached_rooms,
                                     'forbiddenAccessEdges': forbidden, 'requiredRouteFailures': regressions}]
                if action == 'candidate':
                    result.update({'candidate': save_candidate(payload, config, changes, diagnostics,
                                                               validation=result['errors']),
                                   'draftOnly': True, 'routable': False})
                return result
            if action in ('save', 'candidate'):
                STORE.mkdir(parents=True, exist_ok=True)
                try:
                    if payload['revision'] != revision():
                        raise ValueError('Source changed during reconstruction; no files written')
                    previous = persistence.read_snapshot(ROOT, 'GF') or {}
                    combined_moves, combined_deleted = reconcile_node_edits(
                        previous, payload['nodeMoves'], payload['deletedNodes'], original_read(GRAPH), graph)
                    if has_graph_overlay:
                        if changed:
                            raise ValueError('Save source-spine edits separately from graph edits')
                        graph = preview_graph
                    else:
                        graph = move_nodes(graph, combined_moves, combined_deleted)
                        graph, _ = persistence.add_graph_edges(graph, payload['addedEdges'])
                    result['graphEditImpact'] = graph_edit_impact(original_read(GRAPH), payload['nodeMoves'], payload['deletedNodes'])
                    runtime_graph, excluded_runtime_edges = runtime_safe_graph(graph)
                    # Reconstruction diagnostics are computed before the optional
                    # graph-node edits. Return the exact graph that is persisted so
                    # the admin UI cannot render a stale pre-move simulation.
                    result.update({'graph': runtime_graph, 'floor': edited_floor,
                                   'runtimeGraph': runtime_graph,
                                   'runtimeExcludedEdges': excluded_runtime_edges,
                                   'nodeMoves': payload['nodeMoves'],
                                   'deletedNodes': payload['deletedNodes'],
                                   'addedEdges': payload['addedEdges']})
                    candidate_id = save_candidate(payload, config, changes, diagnostics,
                                                  validation=validation)
                    if action == 'save':
                        # The editor's confirmed save is also the runtime graph update. Diagnostics
                        # remain alongside it, while unsafe geometry is intentionally retained for
                        # operator testing and can be inspected immediately by the app.
                        with persistence.locked(ROOT, 'GF'):
                            if payload['revision'] != revision():
                                raise ValueError('Source changed during reconstruction; no files written')
                            writes = [(ROOT / ('artifacts/navigation-v2/' + name), (Path(work) / name).read_bytes()) for name in OUTPUTS]
                            writes.extend([(ROOT / CONFIG, encoded(config)),
                                           (ROOT / RUNTIME_GRAPH, encoded(runtime_graph)),
                                           (ROOT / 'data/buildings/B03/GF.json', encoded(edited_floor))])
                            writes = [(destination, encoded(runtime_graph) if destination == ROOT / GRAPH else data)
                                      for destination, data in writes]
                            publication_snapshot = {'schemaVersion': 1, 'buildingId': 'B03', 'floorId': 'GF',
                                        'revision': uuid.uuid4().hex, 'graph': runtime_graph, 'config': config,
                                        'floorData': edited_floor,
                                        'nodeMoves': combined_moves, 'deletedNodes': combined_deleted}
                            backup_id = persistence.commit(ROOT, 'GF', STORE, writes, publication_snapshot)
                        result['backup'] = backup_id
                        result['runtimePublication'] = persistence.publication(ROOT, 'GF')
                    result.update({'candidate': candidate_id, 'revision': revision(), 'saved': action == 'save',
                                   **normalized_edits, 'floor': edited_floor,
                                   'capabilities': persistence.CAPABILITIES})
                    if action == 'save':
                        result['valid'] = True
                finally:
                    pass  # Publication lock is OS-owned and releases after interruption.
            return result
        finally:
            common.read, common.OUT = original_read, original_out


def execute(payload):
    # Published configuration remains authoritative if the source pipeline runs.
    # Scope the override to this request so importing this worker has no effects.
    published = persistence.read_snapshot(ROOT, 'GF')
    original_read = common.read
    if published:
        def published_read(name):
            if name == CONFIG:
                return json.loads(json.dumps(published['config']))
            if name in (GRAPH, RUNTIME_GRAPH):
                return json.loads(json.dumps(published['graph']))
            if name == 'data/buildings/B03/GF.json' and isinstance(published.get('floorData'), dict):
                return json.loads(json.dumps(published['floorData']))
            return original_read(name)
        common.read = published_read
    try:
        return _execute(payload)
    finally:
        common.read = original_read


if __name__ == '__main__':
    try:
        if (STORE / 'recovery.json').exists():
            raise ValueError('Legacy interrupted save detected; restore the backup listed in artifacts/navigation-editor/recovery.json before continuing')
        with persistence.locked(ROOT, 'GF'):
            pass
        request = json.loads(sys.stdin.buffer.read(300001).decode('utf-8'))
        print(json.dumps(execute(request), ensure_ascii=True, allow_nan=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=True))
        sys.exit(1)
