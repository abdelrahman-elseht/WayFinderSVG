"""Source-backed First Floor admin worker. JSON stdin/stdout, fixed repo paths."""
import hashlib
import json
import math
import os
import copy
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor_01_graph import simplify_graph
from floor_01_graph import derive
from source_geometry import load as load_source_geometry

ROOT = Path(__file__).resolve().parents[2]
CONFIG = 'scripts/semantic-map/floors/01.json'
FLOOR = 'data/buildings/B03/01.json'
GRAPH = 'data/buildings/B03/01.graph.json'
REVIEW = 'data/buildings/B03/01.review.json'
TOPOLOGY = 'data/buildings/B03/01.shortest-paths.review.json'
STORE = ROOT / 'artifacts/floor-01-navigation-editor'


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def revision():
    h = hashlib.sha256()
    for name in (CONFIG, FLOOR, GRAPH, REVIEW, TOPOLOGY):
        h.update(name.encode('utf-8'))
        h.update((ROOT / name).read_bytes())
    return h.hexdigest()


def spines(config):
    return [{'id': f'spine:{i}', 'index': i, 'kind': 'spine',
             'coordinates': [list(point) for point in line],
             'sourceReferences': [f'{CONFIG}#/corridorSpines/{i}']}
            for i, line in enumerate(config['corridorSpines'])]


def preview_graph(spine_records, floor):
    config = read(CONFIG)
    config['corridorSpines'] = [item['coordinates'] for item in spine_records]
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


def load():
    config, graph = read(CONFIG), read(GRAPH)
    compact, stats = simplify_graph(graph)
    floor = read(FLOOR)
    review = read(REVIEW)
    topology = read(TOPOLOGY)
    candidates = sorted(p.stem for p in STORE.glob('draft-*.json')) if STORE.exists() else []
    return {'floorIdentity': {'buildingId': 'B03', 'floorId': '01'},
            'revision': revision(), 'sourceSpines': spines(config), 'spines': spines(config),
            'floor': floor, 'graph': compact,
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
    action = payload.get('action')
    if action == 'load':
        return load()
    if action not in ('preview', 'draft', 'restore', 'validate', 'save'):
        raise ValueError('Unsupported Floor 01 editor action')
    if payload.get('revision') != revision():
        raise ValueError('Source revision changed. Reload before continuing.')
    current = load()
    if action == 'restore':
        candidate = payload.get('candidate')
        if not isinstance(candidate, str) or not candidate.startswith('draft-') or len(candidate) != 38 or any(c not in '0123456789abcdef' for c in candidate[6:]):
            raise ValueError('Invalid draft ID')
        saved = json.loads((STORE / (candidate + '.json')).read_text(encoding='utf-8'))
        return {'candidate': candidate, 'revision': revision(), 'spines': saved['spines'],
                'floorIdentity': current['floorIdentity'], 'draftOnly': True, 'saved': False}
    proposed = validate_spines(payload.get('spines', current['sourceSpines']), current['sourceSpines'])
    changed = proposed != current['sourceSpines']
    if action == 'validate':
        return {'valid': not changed, 'revision': revision(), 'floorIdentity': current['floorIdentity'],
                'spines': current['sourceSpines'], 'diagnostics': [],
                'errors': ['Reviewed source spine geometry is protected from publishing.'] if changed else [],
                'graphSimplification': current['graphSimplification']}
    if action == 'preview':
        preview, preview_evidence = preview_graph(proposed, current['floor'])
        preview_compact, preview_stats = simplify_graph(preview)
        return {'revision': revision(), 'floorIdentity': current['floorIdentity'],
                'sourceSpines': current['sourceSpines'], 'spines': proposed, 'floor': current['floor'],
                'graph': preview_compact, 'evidence': {**current['evidence'], **preview_evidence},
                'diagnostics': [{'kind': 'protected-source-change', 'count': sum(
                    a['coordinates'] != b['coordinates'] for a, b in zip(proposed, current['sourceSpines']))}] if changed else [],
                'graphSimplification': preview_stats,
                'draftOnly': True, 'saved': False,
                'diagnostics': [{'kind': 'protected-source-change', 'count': sum(
                    a['coordinates'] != b['coordinates'] for a, b in zip(proposed, current['sourceSpines']))}]}
    if action == 'save':
        if changed:
            return {'saved': False, 'valid': False, 'revision': revision(),
                    'error': 'Reviewed source spine geometry is protected from publishing.'}
        return {'saved': False, 'valid': False, 'revision': revision(),
                'error': 'No independently supported Floor 01 editor configuration is available to save.'}
    STORE.mkdir(parents=True, exist_ok=True)
    candidate = 'draft-' + uuid.uuid4().hex
    atomic(STORE / (candidate + '.json'), encoded({'revision': revision(), 'spines': proposed}))
    return {'candidate': candidate, 'revision': revision(), 'floorIdentity': current['floorIdentity'],
            'spines': proposed, 'draftOnly': True, 'saved': False}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.buffer.read(300001).decode('utf-8'))
        print(json.dumps(execute(request), ensure_ascii=True, allow_nan=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=True))
        sys.exit(1)
