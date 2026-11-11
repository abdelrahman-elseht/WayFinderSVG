"""Focused Floor 01 editor and graph-reduction checks."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/semantic-map'))
sys.path.insert(0, str(ROOT / 'scripts'))
import floor_01_admin_editor as editor
from floor_01_graph import derive, simplify_graph
from floor_context import read_json
from source_geometry import load as load_source_geometry


def adjacency(graph):
    result = {node['id']: [] for node in graph['nodes']}
    for edge in graph['edges']:
        result[edge['from']].append((edge['to'], edge['distance']))
        result[edge['to']].append((edge['from'], edge['distance']))
    return result


def distances(graph, start):
    import heapq
    links = adjacency(graph)
    best, queue = {start: 0.0}, [(0.0, start)]
    while queue:
        cost, current = heapq.heappop(queue)
        if cost != best[current]:
            continue
        for target, weight in links[current]:
            candidate = cost + weight
            if candidate < best.get(target, float('inf')):
                best[target] = candidate
                heapq.heappush(queue, (candidate, target))
    return best


def graph_components(graph):
    links = adjacency(graph)
    unseen, components = set(links), []
    while unseen:
        seed = min(unseen)
        reached = {seed}
        stack = [seed]
        unseen.remove(seed)
        while stack:
            current = stack.pop()
            for target, _ in links[current]:
                if target in unseen:
                    unseen.remove(target)
                    reached.add(target)
                    stack.append(target)
        components.append(reached)
    return components


class Floor01AdminTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loaded = editor.load()
        cls.floor = json.loads((ROOT / editor.FLOOR).read_text(encoding='utf-8'))
        cls.graph = json.loads((ROOT / editor.GRAPH).read_text(encoding='utf-8'))
        cls.config = read_json(editor.CONFIG)
        generated = derive(copy.deepcopy(cls.floor['rooms']),
                           load_source_geometry(cls.config), cls.config)
        cls.generated = {'nodes': generated[0], 'edges': generated[1],
                         'navigableAreas': generated[2], 'walls': cls.graph['walls'],
                         'metersPerUnit': None, 'calibrationStatus': 'unknown',
                         'status': 'candidate', 'routingPolicy': 'drawing-based'}
        cls.generated_reference = generated[5]

    def test_load_contract_and_protected_source_evidence(self):
        self.assertEqual(self.loaded['floorIdentity'], {'buildingId': 'B03', 'floorId': '01'})
        self.assertEqual(self.loaded['sourceSpines'], self.loaded['spines'])
        self.assertEqual(len(self.loaded['sourceSpines']), 14)
        self.assertEqual(self.loaded['evidence']['graphReview']['missingRouteRooms'][0]['code'], 'F-17')

    def test_draft_restore_and_revision_check(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(editor, 'STORE', Path(temp)):
                payload = {'action': 'draft', 'revision': self.loaded['revision'],
                           'spines': copy.deepcopy(self.loaded['sourceSpines'])}
                draft = editor.execute(payload)
                restored = editor.execute({'action': 'restore', 'revision': self.loaded['revision'],
                                            'candidate': draft['candidate']})
                self.assertTrue(restored['draftOnly'])
                self.assertEqual(restored['spines'], payload['spines'])
        with self.assertRaisesRegex(ValueError, 'revision'):
            editor.execute({'action': 'validate', 'revision': 'stale'})

    def test_save_is_fail_closed_for_protected_floor_config(self):
        result = editor.execute({'action': 'save', 'revision': self.loaded['revision']})
        self.assertFalse(result['saved'])
        self.assertIn('No independently supported', result['error'])

    def test_changed_spines_are_draftable_but_never_publishable(self):
        spines = copy.deepcopy(self.loaded['sourceSpines'])
        spines[0]['coordinates'][0][0] += 1
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(editor, 'STORE', Path(temp)):
                draft = editor.execute({'action': 'draft', 'revision': self.loaded['revision'], 'spines': spines})
                self.assertTrue(draft['draftOnly'])
                restored = editor.execute({'action': 'restore', 'revision': self.loaded['revision'],
                                            'candidate': draft['candidate']})
                self.assertEqual(restored['spines'], spines)
        validation = editor.execute({'action': 'validate', 'revision': self.loaded['revision'], 'spines': spines})
        self.assertFalse(validation['valid'])
        saved = editor.execute({'action': 'save', 'revision': self.loaded['revision'], 'spines': spines})
        self.assertFalse(saved['saved'])
        self.assertIn('protected', saved['error'])

    def test_preview_rebuilds_graph_with_proposed_spines(self):
        proposed = copy.deepcopy(self.loaded['sourceSpines'])
        proposed[0]['coordinates'][0][0] += 1
        topology = {'pairs': [], 'disconnectedPairs': []}
        generated = ([], [], [], [], [], topology)
        with patch.object(editor, 'derive', return_value=generated) as rebuild:
            with patch.object(editor, 'load_source_geometry', return_value={'source': True}):
                graph, evidence = editor.preview_graph(proposed, self.loaded['floor'])
        rooms, context, config = rebuild.call_args.args
        self.assertEqual(config['corridorSpines'],
                         [item['coordinates'] for item in proposed])
        self.assertIsNot(rooms, self.loaded['floor']['rooms'])
        self.assertEqual(context, {'source': True})
        self.assertEqual(graph['nodes'], [])
        self.assertEqual(evidence['shortestPathReference'], topology)
        self.assertEqual(graph['edges'], [])

    def test_simplification_reduces_only_safe_nonsemantic_junctions(self):
        reduced, stats = simplify_graph(self.generated)
        self.assertEqual(stats['originalNodes'], len(self.generated['nodes']))
        self.assertEqual(stats['originalEdges'], len(self.generated['edges']))
        self.assertLess(stats['simplifiedNodes'], stats['originalNodes'])
        self.assertLess(stats['simplifiedEdges'], stats['originalEdges'])
        self.assertEqual({n['id'] for n in reduced['nodes'] if n.get('roomId')},
                         {n['id'] for n in self.graph['nodes'] if n.get('roomId')})
        original_ids = {node['id'] for node in self.generated['nodes']}
        reduced_ids = {node['id'] for node in reduced['nodes']}
        retained_ids = sorted(original_ids & reduced_ids)
        self.assertEqual(retained_ids, sorted(reduced_ids))
        original_distances = {start: distances(self.generated, start)
                              for start in retained_ids}
        reduced_distances = {start: distances(reduced, start)
                             for start in retained_ids}
        for start in retained_ids:
            for end in retained_ids:
                original = original_distances[start].get(end)
                compacted = reduced_distances[start].get(end)
                self.assertEqual(original is None, compacted is None,
                                 (start, end, original, compacted))
                if original is not None:
                    self.assertAlmostEqual(original, compacted, delta=.05,
                                           msg=(start, end, original, compacted))

        endpoints = [r['doorNodeId'] for r in self.floor['rooms'] if r.get('doorNodeId')]
        self.assertEqual(len(endpoints), 51)
        endpoint_nodes = {node['id']: node for node in self.generated['nodes']
                          if node.get('roomId')}
        self.assertEqual(set(endpoint_nodes), set(endpoints))
        self.assertTrue(all(node['status'] == 'candidate'
                            for node in endpoint_nodes.values()))
        endpoint_distances = {start: reduced_distances[start] for start in endpoints}
        reference = self.generated_reference
        self.assertEqual(len(reference['pairs']), 1275)
        reference_pairs = {(item['start'], item['end']): item['distance'] for item in reference['pairs']}
        for pair, expected in reference_pairs.items():
            actual = endpoint_distances[pair[0]].get(pair[1])
            self.assertIsNotNone(actual, pair)
            self.assertLessEqual(actual - expected, .05, (pair, actual, expected))
        original_components = graph_components(self.generated)
        reduced_components = graph_components(reduced)
        self.assertEqual(len(original_components), len(reduced_components))
        self.assertEqual({frozenset(component & set(retained_ids))
                          for component in original_components},
                         {frozenset(component) for component in reduced_components})
        original_cycles = len(self.generated['edges']) - len(self.generated['nodes']) + len(original_components)
        reduced_cycles = len(reduced['edges']) - len(reduced['nodes']) + len(reduced_components)
        self.assertEqual(reduced_cycles, original_cycles)
        areas = unary_union([Polygon(points) for points in self.generated['navigableAreas']])
        walls = unary_union([LineString(points) for points in self.generated['walls']])
        circulation_codes = set(self.config['circulationCodes'])
        room_solids = [Polygon(room['polygon']).buffer(.3)
                       for room in self.floor['rooms']
                       if room.get('polygon') and room['code'] not in circulation_codes]
        for edge in reduced['edges']:
            line = LineString(edge['geometry'])
            self.assertTrue(areas.buffer(.0002).covers(line), edge['id'])
            self.assertFalse(walls.intersects(line), edge['id'])
            self.assertFalse(any(solid.intersects(line) for solid in room_solids), edge['id'])
        original_approaches = {n['id']: n['point'] for n in self.generated['nodes'] if n.get('roomId')}
        reduced_approaches = {n['id']: n['point'] for n in reduced['nodes'] if n.get('roomId')}
        self.assertEqual(reduced_approaches, original_approaches)
        unsupported = {r['code'] for r in self.floor['rooms'] if not r.get('doorNodeId')}
        self.assertEqual(unsupported, {'F-17', 'F-49', 'F-57'})
        self.assertEqual({r['code'] for r in self.loaded['evidence']['sourceStatusExceptions']},
                         {'F-10', 'F-18', 'F-28', 'F-29', 'F-45'})


if __name__ == '__main__':
    unittest.main()
