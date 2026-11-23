"""Source-backed First Floor admin worker. JSON stdin/stdout, fixed repo paths."""
import hashlib
import json
import math
import os
import copy
from pathlib import Path
import sys
import uuid
from shapely.geometry import LineString

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor_01_graph import simplify_graph
from floor_01_graph import derive
from source_geometry import load as load_source_geometry
import navigation_persistence as persistence
from admin_editor import draft_overlay, publication_edits, reconcile_node_edits

ROOT = Path(__file__).resolve().parents[2]
CONFIG = 'scripts/semantic-map/floors/01.json'
FLOOR = 'data/buildings/B03/01.json'
GRAPH = 'data/buildings/B03/01.graph.json'
REVIEW = 'data/buildings/B03/01.review.json'
TOPOLOGY = 'data/buildings/B03/01.shortest-paths.review.json'
STORE = ROOT / 'artifacts/floor-01-navigation-editor'


def read(name):
    published = persistence.read_snapshot(ROOT, '01')
    if published and name in (CONFIG, GRAPH):
        return copy.deepcopy(published['config'] if name == CONFIG else published['graph'])
    if published and name == FLOOR and isinstance(published.get('floorData'), dict):
        return copy.deepcopy(published['floorData'])
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def revision():
    h = hashlib.sha256()
    for name in (CONFIG, FLOOR, GRAPH, REVIEW, TOPOLOGY):
        h.update(name.encode('utf-8'))
        h.update((ROOT / name).read_bytes())
    target = persistence.snapshot_path(ROOT, '01')
    if target.exists():
        h.update(target.read_bytes())
    return h.hexdigest()


def spines(config):
    return [{'id': f'spine:{i}', 'index': i, 'kind': 'spine',
             'coordinates': [list(point) for point in line],
             'sourceReferences': [f'{CONFIG}#/corridorSpines/{i}']}
            for i, line in enumerate(config['corridorSpines'])]


def preview_graph(spine_records, floor, protected_node_ids=()):
    config = read(CONFIG)
    config['corridorSpines'] = [item['coordinates'] for item in spine_records]
    config['junctionCleanupProtectedNodeIds'] = sorted(
        set(config.get('junctionCleanupProtectedNodeIds', [])) | set(protected_node_ids))
    rooms = copy.deepcopy(floor['rooms'])
    nodes, edges, areas, connections, missing, topology = derive(
        rooms, load_source_geometry(config), config)
    graph = {'nodes': nodes, 'edges': edges, 'navigableAreas': areas,
             'walls': read(GRAPH)['walls'], 'metersPerUnit': None,
             'calibrationStatus': 'unknown',
             'status': 'candidate' if edges else 'unknown',
             'routingPolicy': 'drawing-based'}
    return graph, {'connections': connections, 'missingRouteRooms': missing,
                   'shortestPathReference': topology}


def source_links(graph, config):
    """Link existing edges to their configured source-corridor support, not new IDs.

    Grid paths are offset from source centerlines. Preserve that offset when a
    source control moves; never snap or match an edited ID to another node.
    """
    supports = [LineString(line).buffer(config['corridorHalfWidth'], cap_style=2, join_style=2)
                for line in config['corridorSpines']]
    return [{'edgeId': edge['id'], 'sourceSpineIds': owners,
             'sourceReferences': [f'{CONFIG}#/corridorSpines/{index}' for index in owners],
             'preserveOffset': True, 'tests': None}
            for edge in graph['edges']
            if (owners := [index for index, area in enumerate(supports)
                           if area.covers(LineString(edge['geometry']))])]


def load():
    config, graph = read(CONFIG), read(GRAPH)
    # Never simplify a published graph again: edited node identities must survive reload.
    if persistence.read_snapshot(ROOT, '01'):
        compact, stats = graph, {'originalNodes': len(graph['nodes']), 'simplifiedNodes': len(graph['nodes']),
                                 'originalEdges': len(graph['edges']), 'simplifiedEdges': len(graph['edges'])}
    else:
        compact, stats = simplify_graph(graph)
    floor = read(FLOOR)
    review = read(REVIEW)
    topology = read(TOPOLOGY)
    candidates = sorted(p.stem for p in STORE.glob('draft-*.json')) if STORE.exists() else []
    published = persistence.read_snapshot(ROOT, '01')
    links = published.get('sourceLinks') if published else None
    if links is None:
        links = source_links(compact, config)
    return {'floorIdentity': {'buildingId': 'B03', 'floorId': '01'},
            'revision': revision(), 'sourceSpines': spines(config), 'spines': spines(config),
            'floor': floor, 'graph': compact, 'runtimeGraph': compact,
            'config': config, 'sourceLinks': links,
            'capabilities': persistence.CAPABILITIES,
            'authoringSourceReferences': persistence.authoring_source_references(ROOT, floor, spines(config)),
            'mergeProtectedNodeIds': sorted(persistence.merge_protected_ids(ROOT, '01', floor, config)),
            'runtimePublication': persistence.publication(ROOT, '01'),
            'transitionCandidates': persistence.transition_candidates(ROOT, '01', compact),
            'evidence': {'graphReview': review.get('graphReview', {}),
                         'sourceStatusExceptions': [r for r in review.get('rooms', [])
                             if r.get('status') == 'source-status-exception'],
                         'shortestPathReference': topology},
            'diagnostics': [], 'candidates': candidates, 'graphSimplification': stats}


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def validate_spines(value, expected):
    if not isinstance(value, list) or len(value) != len(expected):
        raise ValueError('Source spine collection and identities are fixed')
    checked = []
    for item, source in zip(value, expected):
        if not isinstance(item, dict) or any(item.get(key) != source[key] for key in ('id', 'index', 'kind', 'sourceReferences')):
            raise ValueError('Source spine identity and provenance are protected')
        points = item.get('coordinates')
        if not isinstance(points, list) or not 2 <= len(points) <= 256:
            raise ValueError('Each spine requires 2..256 points')
        for point in points:
            if (not isinstance(point, list) or len(point) != 2 or
                    any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in point) or
                    not 580 <= point[0] <= 3490 or not 315 <= point[1] <= 1900):
                raise ValueError('Spine coordinates must be finite points within the First Floor source frame')
        if any(a == b for a, b in zip(points, points[1:])):
            raise ValueError('Consecutive duplicate spine points are not permitted')
        checked.append({**source, 'coordinates': points})
    return checked


def execute(payload):
    payload = dict(payload)
    if payload.get('floorId', '01') != '01':
        raise ValueError('Submission floor does not match Floor 01 worker')
    action = payload.get('action')
    if action == 'load':
        return load()
    if action not in ('preview', 'draft', 'candidate', 'restore', 'validate', 'save'):
        raise ValueError('Unsupported Floor 01 editor action')
    if payload.get('revision') != revision():
        raise ValueError('Source revision changed. Reload before continuing.')
    current = load()
    if action == 'restore':
        candidate = payload.get('candidate')
        if not isinstance(candidate, str) or not candidate.startswith('draft-') or len(candidate) != 38 or any(c not in '0123456789abcdef' for c in candidate[6:]):
            raise ValueError('Invalid draft ID')
        saved = json.loads((STORE / (candidate + '.json')).read_text(encoding='utf-8'))
        persistence.validate_merge_candidate(saved, payload['revision'], current['graph'],
                                             current.get('mergeProtectedNodeIds', ()))
        persistence.validate_authoring_candidate(
            saved, current['graph'], current['floor'],
            protected_ids=current.get('mergeProtectedNodeIds', ()),
            source_references=current['authoringSourceReferences'],
            exclusions=current['config'].get('voidExclusions', []),
            known_transition_nodes=persistence.transition_nodes(ROOT, '01'))
        return {'candidate': candidate, 'revision': revision(), 'spines': saved['spines'],
                'nodeMoves': saved.get('explicitNodeMoves', saved.get('nodeMoves', {})), 'deletedNodes': saved.get('deletedNodes', []),
                'addedEdges': saved.get('addedEdges', []),
                'nodeMerges': saved.get('nodeMerges', {}),
                **persistence.authoring_edits(saved),
                'floorIdentity': current['floorIdentity'], 'draftOnly': True, 'saved': False}
    proposed = validate_spines(payload.get('spines', current['sourceSpines']), current['sourceSpines'])
    changed = proposed != current['sourceSpines']
    moves, deleted = validate_node_edits(payload, current['graph'])
    added_edges = payload.get('addedEdges', [])
    if not isinstance(added_edges, list) or len(added_edges) > 1000:
        raise ValueError('Invalid added-edge collection')
    applied, explicit = draft_overlay(payload, moves, current['graph'], current['sourceSpines'], proposed,
                                      current.get('sourceLinks', []))
    merges = payload.get('nodeMerges', {})
    payload.update(persistence.authoring_edits(payload))
    protected = persistence.merge_protected_ids(ROOT, '01', current['floor'], current['config']) if merges else ()
    source_references = persistence.authoring_source_references(ROOT, current['floor'], current['sourceSpines'])
    overlay, overlay_excluded, edited_floor, merge, normalized_edits = persistence.authored_overlay(
        current['graph'], current['floor'], payload, applied, deleted, added_edges, merges,
        protected_ids=protected, source_references=source_references,
        exclusions=current['config'].get('voidExclusions', []),
        known_transition_nodes=persistence.transition_nodes(ROOT, '01'))
    payload.update(normalized_edits)
    merged_links = persistence.merge_source_links(current.get('sourceLinks', []), merge)
    if action == 'validate':
        return {'valid': True, 'revision': revision(), 'floorIdentity': current['floorIdentity'],
                'spines': proposed, 'diagnostics': [], 'errors': [],
                'graphSimplification': current['graphSimplification']}
    if action in ('draft', 'candidate'):
        STORE.mkdir(parents=True, exist_ok=True)
        candidate = 'draft-' + uuid.uuid4().hex
        atomic(STORE / (candidate + '.json'), encoded({'revision': revision(), 'spines': proposed,
                                                     'nodeMoves': applied, 'explicitNodeMoves': explicit,
                                                     'deletedNodes': deleted, 'addedEdges': added_edges,
                                                     'nodeMerges': merges}))
        saved = json.loads((STORE / (candidate + '.json')).read_text(encoding='utf-8'))
        saved.update(normalized_edits)
        atomic(STORE / (candidate + '.json'), encoded(saved))
        return {'candidate': candidate, 'revision': revision(), 'floorIdentity': current['floorIdentity'],
                'spines': proposed, 'graph': overlay, 'floor': edited_floor,
                **normalized_edits, 'draftOnly': True, 'saved': False}
    graph, evidence, stats = current['graph'], {}, current['graphSimplification']
    previous = persistence.read_snapshot(ROOT, '01') or {}
    authoring = any(normalized_edits.values())
    if changed and action != 'save' and not merges and not authoring:
        protected_edits = set(moves) | set(deleted) | set(previous.get('nodeMoves', {})) | set(previous.get('deletedNodes', []))
        rebuilt, evidence = preview_graph(proposed, current['floor'], protected_node_ids=protected_edits)
        graph, stats = simplify_graph(rebuilt, protected_node_ids=protected_edits)
    if action == 'save' or merges or authoring:
        combined_moves, combined_deleted = publication_edits(previous, applied, deleted, current['graph'])
        graph, excluded = overlay, overlay_excluded
        combined_moves = {key: point for key, point in combined_moves.items() if key not in merge['aliases']}
    else:
        combined_moves, combined_deleted = reconcile_node_edits(
            previous, explicit, deleted, current['graph'], graph)
        graph, excluded = persistence.edited_graph(graph, combined_moves, combined_deleted, added_edges)
    result = {'revision': revision(), 'floorIdentity': current['floorIdentity'],
              'sourceSpines': proposed, 'spines': proposed, 'floor': current['floor'],
              'graph': graph, 'runtimeGraph': graph, 'runtimeExcludedEdges': excluded,
              'nodeMoves': applied, 'explicitNodeMoves': explicit, 'deletedNodes': deleted,
              'addedEdges': added_edges,
              'nodeMerges': merges, 'sourceLinks': merged_links,
              **normalized_edits, 'floor': edited_floor,
              'evidence': {**current['evidence'], **evidence}, 'graphSimplification': stats,
              'diagnostics': [], 'errors': [], 'valid': True, 'saved': False,
              'draftOnly': action == 'preview', 'capabilities': persistence.CAPABILITIES,
              'runtimePublication': persistence.publication(ROOT, '01')}
    if action == 'save':
        with persistence.locked(ROOT, '01'):
            if payload['revision'] != revision():
                raise ValueError('Source changed during reconstruction; no files written')
            config = read(CONFIG)
            config['corridorSpines'] = [item['coordinates'] for item in proposed]
            snapshot = {'schemaVersion': 1, 'buildingId': 'B03', 'floorId': '01',
                        'revision': uuid.uuid4().hex, 'graph': graph, 'config': config,
                        'floorData': edited_floor,
                        'authorship': 'admin-authored loaded-graph overlay; not reconstructed or geometry-verified',
                        'sourceLinks': merged_links,
                        'nodeMergeHistory': [*previous.get('nodeMergeHistory', []), *([{
                            **merge, 'sourceLinks': current.get('sourceLinks', []),
                            'incidentEdges': [edge for edge in current['graph']['edges'] if edge['from'] in merges or edge['to'] in merges]
                        }] if merges else [])],
                        'nodeMoves': combined_moves, 'deletedNodes': combined_deleted}
            writes = [(ROOT / CONFIG, encoded(config)), (ROOT / GRAPH, encoded(graph)),
                      (ROOT / FLOOR, encoded(edited_floor))]
            result['backup'] = persistence.commit(ROOT, '01', STORE, writes, snapshot)
        result.update({'saved': True, 'draftOnly': False, 'revision': revision(),
                       'runtimePublication': persistence.publication(ROOT, '01')})
    return result


def validate_node_edits(payload, graph):
    moves, deleted = payload.get('nodeMoves', {}), payload.get('deletedNodes', [])
    if not isinstance(moves, dict) or len(moves) > 1000:
        raise ValueError('Invalid node move collection')
    if (not isinstance(deleted, list) or len(deleted) > 1000 or
            any(not isinstance(key, str) for key in deleted) or len(set(deleted)) != len(deleted)):
        raise ValueError('Invalid deleted-node collection')
    allowed = {node['id'] for node in graph['nodes']} | persistence.pending_node_ids(payload)
    if any(key not in allowed for key in [*moves, *deleted]):
        raise ValueError('Node edits must reference existing Floor 01 graph nodes')
    for point in moves.values():
        if (not isinstance(point, list) or len(point) != 2 or
                any(type(axis) not in (int, float) or not math.isfinite(axis) for axis in point) or
                not 580 <= point[0] <= 3490 or not 315 <= point[1] <= 1900):
            raise ValueError('Node coordinates must be finite points within the First Floor source frame')
    return moves, deleted


if __name__ == '__main__':
    try:
        with persistence.locked(ROOT, '01'):
            pass
        request = json.loads(sys.stdin.buffer.read(300001).decode('utf-8'))
        print(json.dumps(execute(request), ensure_ascii=True, allow_nan=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=True))
        sys.exit(1)
