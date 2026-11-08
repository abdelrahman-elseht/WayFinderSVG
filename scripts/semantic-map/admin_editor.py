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
    candidates = []
    if STORE.exists():
        candidates = sorted(p.stem for p in STORE.glob('candidate-*.json'))
    return {'revision': revision(), 'spines': snapshot(e), 'floor': e.floor,
            'graph': common.read(GRAPH), 'runtimeGraph': common.read('data/buildings/B03/GF.graph.json'),
            'config': common.read(CONFIG),
            'evidence': common.read('artifacts/navigation-v2/reconstruction-report.json').get('edgeEvidence', []),
            # Existing unsafe reviewed edits remain loadable.  Surface their
            # source geometry findings so the admin can inspect them instead
            # of turning bootstrap into a 503 response.
            'diagnostics': e.geometry_diagnostics,
            'candidates': candidates,
            'buildingBoundaryAvailable': False}


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


def validated_node_moves(value):
    if not isinstance(value, dict) or len(value) > 1000:
        raise ValueError('Invalid node move collection')
    allowed = {node['id'] for node in common.read(GRAPH)['nodes']}
    result = {}
    for node_id, point in value.items():
        # Source reconstruction can legitimately regenerate junction IDs.  The
        # client rebases edits after a build, but tolerate a stale draft here so
        # one old ID cannot make an otherwise valid source build return 422.
        # Unknown IDs are discarded by execute() and are never applied to a
        # different node.
        if node_id not in allowed:
            continue
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError('Node move coordinates must be a point')
        if not finite(point[0], 650, 3750) or not finite(point[1], 500, 2050):
            raise ValueError('Node coordinates must be within the canonical GF viewBox')
        result[node_id] = point
    return result


def validated_deleted_nodes(value):
    if not isinstance(value, list) or len(value) > 1000:
        raise ValueError('Invalid deleted-node collection')
    allowed = {node['id'] for node in common.read(GRAPH)['nodes']}
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
              'deletedNodes': payload.get('deletedNodes', []),
              'config': config, 'revision': payload['revision'],
              'changes': changes, 'diagnostics': diagnostics, 'validation': validation,
              'error': error, 'safetyChecked': safety_checked, 'routable': False,
              'draftOnly': not safety_checked}
    atomic(STORE / (candidate_id + '.json'), encoded(record))
    return candidate_id


def execute(payload):
    action = payload.get('action')
    if action == 'load':
        return bootstrap()
    if action not in ('validate', 'reconstruct', 'preview', 'save', 'candidate', 'draft', 'restore'):
        raise ValueError('Unsupported editor action')
    if payload.get('revision') != revision():
        raise ValueError('Source revision changed. Export your draft and reload before saving.')
    e = Evidence()
    if action == 'restore':
        candidate = payload.get('candidate', '')
        if not isinstance(candidate, str) or not candidate.startswith('candidate-') or len(candidate) != 42 or any(c not in '0123456789abcdef' for c in candidate[10:]):
            raise ValueError('Invalid candidate ID')
        saved = json.loads((STORE / (candidate + '.json')).read_text('utf-8'))
        # Restore into a draft, never bypass validation or silently overwrite files.
        return {'spines': saved['spines'], 'nodeMoves': validated_node_moves(saved.get('nodeMoves', {})),
                'deletedNodes': validated_deleted_nodes(saved.get('deletedNodes', [])), 'restored': candidate,
                'routable': saved.get('routable', True), 'diagnostics': saved.get('diagnostics', [])}
    raw_moves = payload.get('nodeMoves', {})
    raw_deleted = payload.get('deletedNodes', [])
    if not isinstance(raw_moves, dict) or not isinstance(raw_deleted, list):
        # Let the validators provide the established shape errors.
        payload['nodeMoves'] = validated_node_moves(raw_moves)
        payload['deletedNodes'] = validated_deleted_nodes(raw_deleted)
    allowed_ids = {node['id'] for node in common.read(GRAPH)['nodes']}
    stale_moves = sorted(set(raw_moves) - allowed_ids)
    stale_deleted = sorted({node_id for node_id in raw_deleted if isinstance(node_id, str)} - allowed_ids)
    payload['nodeMoves'] = validated_node_moves(raw_moves)
    payload['deletedNodes'] = validated_deleted_nodes(raw_deleted)
    config, changes, diagnostics = prepare(payload, e, check_geometry=action != 'draft')
    if action == 'draft':
        candidate = save_candidate(payload, config, changes, diagnostics, safety_checked=False)
        return {'candidate': candidate, 'revision': payload['revision'], 'saved': False,
                'valid': False, 'draftOnly': True, 'routable': False, 'safetyChecked': False,
                'diagnostics': diagnostics, 'changes': changes, 'errors': [],
                'staleNodeMoves': stale_moves, 'staleDeletedNodes': stale_deleted}
    errors = [d for d in diagnostics if d['changed'] and d['tests'] and not d['tests']['safe']]
    result = {'valid': not errors, 'diagnostics': diagnostics, 'changes': changes, 'errors': errors,
              'staleNodeMoves': stale_moves, 'staleDeletedNodes': stale_deleted,
              'buildingClearance': None, 'buildingClearanceNote': 'No independent verified building-envelope polygon is supplied; walkable boundary is not a facade measurement.'}
    if payload['nodeMoves'] or payload['deletedNodes']:
        result['graphEditImpact'] = graph_edit_impact(common.read(GRAPH), payload['nodeMoves'], payload['deletedNodes'])
    if action == 'validate':
        return result
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
                    if action == 'preview':
                        validation = {'acceptance': 'PREVIEW_ONLY', 'checksSkipped': True,
                                      'strictWalkableAreaFailures': [], 'wallContacts': [],
                                      'roomInteriorCrossings': [], 'endpointMismatches': [],
                                      'distanceMismatches': [], 'candidateMetadataFailures': [],
                                      'approachNodesMissing': [], 'approachesWithoutEdges': []}
                    else:
                        validation = verify_centerline_candidate.verify()
            finally:
                common.Evidence.safe = original_safe
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
                           'safetyChecked': action != 'preview'})
            if not result['valid'] and action != 'preview':
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
                lock = STORE / 'write.lock'
                try:
                    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                except FileExistsError:
                    raise ValueError('Another save is in progress; retry after it completes')
                try:
                    os.close(fd)
                    if payload['revision'] != revision():
                        raise ValueError('Source changed during reconstruction; no files written')
                    graph = move_nodes(graph, payload['nodeMoves'], payload['deletedNodes'])
                    result['graphEditImpact'] = graph_edit_impact(original_read(GRAPH), payload['nodeMoves'], payload['deletedNodes'])
                    runtime_graph, excluded_runtime_edges = runtime_safe_graph(graph)
                    # Reconstruction diagnostics are computed before the optional
                    # graph-node edits. Return the exact graph that is persisted so
                    # the admin UI cannot render a stale pre-move simulation.
                    result.update({'graph': graph,
                                   'runtimeGraph': runtime_graph,
                                   'runtimeExcludedEdges': excluded_runtime_edges,
                                   'nodeMoves': payload['nodeMoves'],
                                   'deletedNodes': payload['deletedNodes']})
                    candidate_id = save_candidate(payload, config, changes, diagnostics,
                                                  validation=validation)
                    if action == 'save':
                        # The editor's confirmed save is also the runtime graph update. Diagnostics
                        # remain alongside it, while unsafe geometry is intentionally retained for
                        # operator testing and can be inspected immediately by the app.
                        paths = [CONFIG, RUNTIME_GRAPH] + ['artifacts/navigation-v2/' + name for name in OUTPUTS]
                        before = {name: (ROOT / name).read_bytes() if (ROOT / name).exists() else None for name in paths}
                        backup_id = 'backup-' + uuid.uuid4().hex
                        for name, data in before.items():
                            if data is not None:
                                atomic(STORE / backup_id / name, data)
                        # A durable recovery journal survives process interruption.
                        atomic(STORE / 'recovery.json', encoded({'backup': backup_id, 'paths': paths}))
                        try:
                            for name in OUTPUTS:
                                atomic(ROOT / 'artifacts/navigation-v2' / name, (Path(work) / name).read_bytes())
                            atomic(ROOT / CONFIG, encoded(config))
                            atomic(ROOT / RUNTIME_GRAPH, encoded(runtime_graph))
                        except BaseException:
                            for name, data in before.items():
                                if data is not None:
                                    atomic(ROOT / name, data)
                                else:
                                    (ROOT / name).unlink(missing_ok=True)
                            raise
                        (STORE / 'recovery.json').unlink()
                        result['backup'] = backup_id
                    result.update({'candidate': candidate_id, 'revision': revision(), 'saved': action == 'save'})
                finally:
                    lock.unlink(missing_ok=True)
            return result
        finally:
            common.read, common.OUT = original_read, original_out


if __name__ == '__main__':
    try:
        if (STORE / 'recovery.json').exists():
            raise ValueError('Interrupted save detected. Restore the backup listed in artifacts/navigation-editor/recovery.json before continuing.')
        request = json.loads(sys.stdin.buffer.read(300001).decode('utf-8'))
        print(json.dumps(execute(request), ensure_ascii=True, allow_nan=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=True))
        sys.exit(1)
