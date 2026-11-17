"""Synthetic authoring transactions through both real workers, only in temp roots."""
import copy
from contextlib import ExitStack
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/semantic-map'))
sys.path.insert(0, str(ROOT / 'scripts'))
import admin_editor as gf
import floor_01_admin_editor as first
import navigation_persistence as persistence
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union


def synthetic_bundle(floor_id):
    source = f'maps/B03/{floor_id}/master.svg'
    evidence = {'source': source, 'page': 1, 'note': 'SYNTHETIC TEST ONLY', 'status': 'candidate'}
    floor = {
        'schemaVersion': 1,
        'building': {'id': 'B03', 'name': {'en': 'Synthetic', 'ar': 'Synthetic'}, 'floorIds': [floor_id]},
        'floor': {'id': floor_id, 'buildingId': 'B03', 'name': {'en': floor_id, 'ar': floor_id},
                  'level': 0 if floor_id == 'GF' else 1, 'viewBox': [1000, 800, 300, 300],
                  'mapAsset': '/' + source, 'metersPerUnit': None, 'calibrationStatus': 'unknown'},
        'rooms': [{'id': 'lab', 'code': 'TEST', 'buildingId': 'B03', 'floorId': floor_id,
                   'name': {'en': 'Synthetic lab', 'ar': 'Synthetic lab'}, 'category': 'laboratory',
                   'polygon': None, 'geometryRef': None, 'geometryStatus': 'unknown',
                   'centroid': [1140, 880], 'doorNodeId': None, 'aliases': [], 'contentRef': 'lab-content',
                   'public': True, 'provenance': [evidence], 'navigationPartial': True,
                   'navigationNote': {'en': 'Original endpoint qualification', 'ar': 'Original Arabic qualification'}}],
        'kiosks': [],
    }
    points = {'a': [1100, 900], 'b': [1100, 900], 'c': [1100, 900],
              'west': [1050, 900], 'east': [1150, 900], 'north': [1100, 850],
              'obsolete': [1050, 950]}
    nodes = [{'id': key, 'point': point, 'buildingId': 'B03', 'floorId': floor_id,
              'type': 'junction', 'status': 'candidate'} for key, point in points.items()]
    edges = []
    for key, start, end, geometry, bidirectional in (
            ('left', 'west', 'a', [[1050, 900], [1075, 895], [1100, 900]], True),
            ('right', 'b', 'east', [[1100, 900], [1125, 905], [1150, 900]], False),
            ('obsolete-edge', 'west', 'obsolete', [[1050, 900], [1050, 950]], True)):
        edges.append({'id': key, 'from': start, 'to': end, 'floorId': floor_id,
                      'geometry': geometry, 'distance': LineString(geometry).length,
                      'distanceUnit': 'map-unit', 'pathType': 'corridor', 'bidirectional': bidirectional,
                      'accessibility': 'unknown', 'restriction': 'unknown', 'status': 'candidate',
                      'provenance': [copy.deepcopy(evidence)]})
    graph = {'nodes': nodes, 'edges': edges, 'walls': [[[1185, 800], [1185, 1000]]],
             'navigableAreas': [[[1000, 800], [1200, 800], [1200, 1000], [1000, 1000]]],
             'metersPerUnit': None, 'calibrationStatus': 'unknown', 'status': 'candidate',
             'routingPolicy': 'drawing-based'}
    config = {'corridorSpines': [[[1050, 900], [1100, 900]], [[1100, 900], [1150, 900]]],
              'corridorHalfWidth': 10, 'reviewedSpineOverrides': []}
    if floor_id == 'GF':
        config['reviewedConnections'] = []
    links = [{'edgeId': edge['id'], 'sourceSpineIds': [0], 'sourceReferences': [source],
              'preserveOffset': True, 'tests': {'synthetic': True}} for edge in edges]
    return floor, graph, config, links, source


class AdminAuthoringWorkerTests(unittest.TestCase):
    def isolated(self, floor_id):
        stack = ExitStack()
        self.addCleanup(stack.close)
        root = Path(stack.enter_context(tempfile.TemporaryDirectory()))
        worker = gf if floor_id == 'GF' else first
        floor, graph, config, links, source = synthetic_bundle(floor_id)
        files = {worker.CONFIG: config, worker.GRAPH: graph,
                 f'data/buildings/B03/{floor_id}.json': floor,
                 'artifacts/navigation-v2/reconstruction-report.json': {'edgeEvidence': links}}
        if floor_id == 'GF':
            files.update({gf.BASE: config, gf.RUNTIME_GRAPH: graph})
        else:
            files.update({first.REVIEW: {}, first.TOPOLOGY: {}})
        for name, value in files.items():
            persistence.atomic(root / name, persistence.encoded(value))
        persistence.atomic(root / source, b'<svg/>')
        stack.enter_context(patch.dict(os.environ, {
            'WAYFINDING_NAVIGATION_STORE': str(root / 'publication.json'),
            'WAYFINDING_TRANSITION_STORE': str(root / 'transitions.json')}))
        stack.enter_context(patch.object(worker, 'ROOT', root))
        stack.enter_context(patch.object(worker, 'STORE', root / 'editor'))
        persistence.atomic(persistence.snapshot_path(root, floor_id), persistence.encoded({
            'schemaVersion': 1, 'buildingId': 'B03', 'floorId': floor_id,
            'revision': 'initial', 'graph': graph, 'config': config, 'floorData': floor, 'sourceLinks': links}))
        if floor_id == 'GF':
            evidence = SimpleNamespace(floor=floor, geometry_diagnostics=[], walls=[],
                                       domain=Polygon(graph['navigableAreas'][0]))
            stack.enter_context(patch.object(gf.common, 'ROOT', root))
            stack.enter_context(patch.object(gf, 'Evidence', return_value=evidence))
            stack.enter_context(patch.object(gf, 'snapshot', side_effect=lambda _: [
                {'id': f'spine:{i}', 'index': i, 'kind': 'spine', 'coordinates': line,
                 'sourceReferences': [source]} for i, line in enumerate(config['corridorSpines'])]))
            stack.enter_context(patch.object(gf, 'prepare', side_effect=lambda *a, **k: (copy.deepcopy(config), [], [])))
            import reconstruct_centerline_graph
            stack.enter_context(patch.object(reconstruct_centerline_graph, 'reconstruct',
                side_effect=lambda: (copy.deepcopy(graph), {'edgeEvidence': [], 'approaches': []})))
        return worker, root, floor, graph, source

    def payload(self, worker, floor_id, source):
        prefix = f'B03-{floor_id}-admin-'
        review = {'sourceReference': source, 'note': 'SYNTHETIC administrator drawing review'}
        return {
            'floorId': floor_id, 'revision': worker.revision(),
            'spines': worker.execute({'action': 'load'})['spines'],
            'nodeMoves': {'a': [1100.1, 900], 'b': [1100.1, 900], 'c': [1100.1, 900]},
            'explicitNodeMoves': {'a': [1100.1, 900], 'b': [1100.1, 900], 'c': [1100.1, 900]},
            'deletedNodes': ['obsolete'], 'nodeMerges': {'b': 'a', 'c': 'a'},
            'navigableAreaEdits': [{'id': 'subtract-hole', 'operation': 'subtract',
                                   'polygon': [[1160, 960], [1170, 960], [1170, 970], [1160, 970]], **review}],
            'addedNodes': [
                {'id': prefix + 'node-junction', 'buildingId': 'B03', 'floorId': floor_id,
                 'point': [1120, 880], 'type': 'junction', 'status': 'candidate', **review},
                {'id': prefix + 'node-entry', 'buildingId': 'B03', 'floorId': floor_id,
                 'point': [1140, 880], 'type': 'entrance', 'roomId': 'lab', 'status': 'candidate', **review}],
            'addedEdges': [
                {'id': prefix + 'main', 'floorId': floor_id, 'from': 'c', 'to': prefix + 'node-junction'},
                {'id': prefix + 'entry', 'floorId': floor_id, 'from': prefix + 'node-junction', 'to': prefix + 'node-entry'}],
            'roomEntryBindings': [{'roomId': 'lab', 'nodeId': prefix + 'node-entry', **review}],
            'edgeGeometryEdits': {'right': {'geometry': [[1100.1, 900], [1125, 910], [1150, 900]], **review}},
        }

    def roundtrip(self, floor_id):
        worker, root, floor, graph, source = self.isolated(floor_id)
        original_floor = copy.deepcopy(floor)
        payload = self.payload(worker, floor_id, source)
        initial = persistence.snapshot_path(root, floor_id).read_bytes()
        for action in ('preview', 'draft', 'candidate'):
            output = worker.execute({**payload, 'action': action})
            self.assertEqual(persistence.snapshot_path(root, floor_id).read_bytes(), initial)
            if action == 'preview':
                preview = output
            else:
                restored = worker.execute({'action': 'restore', 'revision': payload['revision'],
                                           'floorId': floor_id, 'candidate': output['candidate']})
                for key in persistence.AUTHORING_DEFAULTS:
                    self.assertEqual(restored[key], payload[key])
                again = worker.execute({**payload, **restored, 'action': 'preview'})
                self.assertEqual(again['graph'], preview['graph'])
                self.assertEqual(again['floor'], preview['floor'])
        saved = worker.execute({**payload, 'action': 'save'})
        self.assertTrue(saved['saved'])
        self.assertFalse(saved['draftOnly'])
        self.assertEqual(saved['graph'], preview['graph'])
        self.assertEqual(saved['floor'], preview['floor'])
        stored = json.loads(persistence.snapshot_path(root, floor_id).read_text('utf-8'))
        self.assertEqual(stored['graph'], saved['graph'])
        self.assertEqual(stored['floorData'], saved['floor'])
        self.assertEqual(json.loads((root / f'data/buildings/B03/{floor_id}.json').read_text('utf-8')), saved['floor'])
        reloaded = worker.execute({'action': 'load'})
        self.assertEqual(reloaded['graph'], stored['graph'])
        self.assertEqual(reloaded['floor'], stored['floorData'])
        domain = unary_union([Polygon(ring) for ring in reloaded['graph']['navigableAreas']])
        self.assertFalse(domain.covers(Point(1165, 965)))
        self.assertFalse(domain.covers(LineString([[1155, 965], [1175, 965]])))
        self.assertTrue(domain.covers(Point(1155, 965)))
        audit = reloaded['graph']['adminAuthoring']
        self.assertEqual(audit['originalNavigableAreas'], graph['navigableAreas'])
        self.assertEqual(audit['navigableAreaEdits'][0]['review']['status'], 'candidate')
        self.assertEqual(audit['edgeGeometryEdits'][0]['before'], graph['edges'][1])
        room = reloaded['floor']['rooms'][0]
        self.assertEqual(room['doorNodeId'], f'B03-{floor_id}-admin-node-entry')
        self.assertTrue(room['navigationPartial'])
        self.assertIn(original_floor['rooms'][0]['navigationNote']['en'], room['navigationNote']['en'])
        self.assertIn('unverified', room['navigationNote']['en'])
        self.assertTrue(room['navigationNote']['ar'])
        self.assertEqual(room['provenance'], original_floor['rooms'][0]['provenance'])
        self.assertEqual(room['adminEndpointHistory'][0]['doorNodeId'], None)
        for node in reloaded['graph']['nodes']:
            if node.get('adminReview'):
                self.assertEqual(node['status'], 'candidate')
                self.assertEqual(node['adminReview']['accessibility'], 'unknown')
        right = next(edge for edge in reloaded['graph']['edges'] if edge['id'] == 'right')
        self.assertFalse(right['bidirectional'])
        self.assertEqual(right['provenance'], graph['edges'][1]['provenance'])
        self.assertEqual(right['from'], 'a')
        self.assertNotIn('obsolete', {node['id'] for node in reloaded['graph']['nodes']})
        with self.assertRaisesRegex(ValueError, 'revision changed'):
            worker.execute({**payload, 'action': 'save'})
        with self.assertRaisesRegex(ValueError, 'candidate revision changed'):
            worker.execute({'action': 'restore', 'revision': worker.revision(),
                            'floorId': floor_id, 'candidate': output['candidate']})
        unchanged = worker.execute({'action': 'save', 'floorId': floor_id, 'revision': worker.revision(),
                                    'spines': reloaded['spines'], 'nodeMoves': {}, 'explicitNodeMoves': {}})
        self.assertEqual(unchanged['graph'], saved['graph'])
        self.assertEqual(unchanged['floor'], saved['floor'])
        self.assertIsNone(persistence.read_snapshot(root, '01' if floor_id == 'GF' else 'GF'))
        restore_area = {**payload['navigableAreaEdits'][0], 'id': 'restore-hole', 'operation': 'add'}
        restored = worker.execute({'action': 'save', 'floorId': floor_id, 'revision': worker.revision(),
                                   'spines': reloaded['spines'], 'navigableAreaEdits': [restore_area]})
        self.assertTrue(unary_union([Polygon(ring) for ring in restored['graph']['navigableAreas']]).covers(Point(1165, 965)))

    def test_ground_floor_serialized_authoring_lifecycle(self):
        self.roundtrip('GF')

    def test_first_floor_serialized_authoring_lifecycle(self):
        self.roundtrip('01')

    def test_both_floors_reject_unsupported_exterior_and_source_spoof_without_writes(self):
        for floor_id in ('GF', '01'):
            with self.subTest(floor=floor_id):
                worker, root, _, _, source = self.isolated(floor_id)
                payload = self.payload(worker, floor_id, source)
                before = persistence.snapshot_path(root, floor_id).read_bytes()
                outside = {'id': 'outside', 'operation': 'add',
                           'polygon': [[1210, 810], [1220, 810], [1220, 820], [1210, 820]],
                           'sourceReference': source, 'note': 'Inside viewBox is not evidence'}
                for action in ('preview', 'draft', 'save'):
                    with self.assertRaisesRegex(ValueError, 'exceeds original supported'):
                        worker.execute({**payload, 'action': action, 'navigableAreaEdits': [outside]})
                    self.assertEqual(persistence.snapshot_path(root, floor_id).read_bytes(), before)
                with self.assertRaisesRegex(ValueError, 'sourceReference'):
                    worker.execute({**payload, 'action': 'save', 'addedNodes': [
                        {**node, 'sourceReference': 'not-floor-evidence'} for node in payload['addedNodes']]})
                self.assertEqual(persistence.snapshot_path(root, floor_id).read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
