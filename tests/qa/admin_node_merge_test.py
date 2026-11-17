"""Synthetic merge roundtrips through both real workers in disposable roots."""
import copy
import json
import math
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


def fixture(floor_id):
    points = {'a': [1100, 900], 'b': [1100, 900], 'c': [1100, 900],
              'west': [1050, 900], 'east': [1150, 900], 'north': [1100, 850]}
    nodes = [{'id': key, 'point': value, 'buildingId': 'B03', 'floorId': floor_id,
              'type': 'junction', 'status': 'candidate'} for key, value in points.items()]
    edges = []
    for key, start, end, middle, bidirectional in (
            ('left', 'west', 'a', [1075, 895], True),
            ('right', 'b', 'east', [1125, 905], False)):
        geometry = [points[start], middle, points[end]]
        edges.append({'id': key, 'from': start, 'to': end, 'geometry': geometry,
                      'distance': sum(math.dist(a, b) for a, b in zip(geometry, geometry[1:])),
                      'floorId': floor_id, 'pathType': 'corridor', 'distanceUnit': 'map-unit',
                      'accessibility': 'unknown', 'restriction': 'unknown',
                      'status': 'candidate', 'bidirectional': bidirectional,
                      'provenance': [{'source': 'synthetic-test', 'record': key}]})
    graph = {'nodes': nodes, 'edges': edges, 'walls': [],
             'navigableAreas': [[[1000, 800], [1200, 800], [1200, 1000], [1000, 1000]]],
             'metersPerUnit': None, 'calibrationStatus': 'unknown', 'status': 'candidate',
             'routingPolicy': 'drawing-based'}
    links = [{'edgeId': edge['id'], 'sourceSpineIds': [i], 'sourceReferences': [f'source:{i}'],
              'preserveOffset': True, 'tests': {'proof': edge['id']}} for i, edge in enumerate(edges)]
    return graph, links


class MergeAlgorithmTests(unittest.TestCase):
    def test_branches_direction_geometry_and_evidence_are_preserved(self):
        for floor_id in ('GF', '01'):
            with self.subTest(floor=floor_id):
                graph, links = fixture(floor_id)
                before = copy.deepcopy(graph)
                merged, info = persistence.merge_graph_nodes(graph, {'c': 'b', 'b': 'a'})
                self.assertEqual(graph, before)
                self.assertEqual([n['id'] for n in merged['nodes']], ['a', 'west', 'east', 'north'])
                self.assertEqual(merged['edges'], [{**edge, 'from': 'a' if edge['from'] == 'b' else edge['from']}
                                                 for edge in before['edges']])
                self.assertEqual(persistence.merge_source_links(links, info), links)
                persistence.assert_graph(merged, floor_id)

    def test_safe_equivalent_dedupe_keeps_distinct_metadata_and_one_way_edges(self):
        graph, links = fixture('GF')
        original = graph['edges'][0]
        graph['edges'] += [{**copy.deepcopy(original), 'id': 'equivalent', 'to': 'b'},
                           {**copy.deepcopy(original), 'id': 'one-way', 'to': 'b', 'bidirectional': False},
                           {**copy.deepcopy(original), 'id': 'different-evidence', 'to': 'c', 'provenance': ['other']}]
        links.append({**links[0], 'edgeId': 'equivalent', 'sourceReferences': ['separate-proof']})
        merged, info = persistence.merge_graph_nodes(graph, {'b': 'a', 'c': 'a'})
        self.assertEqual({e['id'] for e in merged['edges']}, {'left', 'right', 'one-way', 'different-evidence'})
        self.assertEqual(info['edgeIds']['equivalent'], 'left')
        self.assertEqual(persistence.merge_source_links(links, info)[-1]['sourceReferences'], ['separate-proof'])

    def test_invalid_or_identity_destroying_merges_are_rejected(self):
        graph, _ = fixture('01')
        for changes, message in (({'floorId': 'GF'}, 'same-floor'), ({'roomId': 'room'}, 'cannot be merged'),
                                 ({'type': 'door'}, 'cannot be merged'), ({'reason': 'approach'}, 'cannot be merged'),
                                 ({'status': 'unknown'}, 'metadata or evidence'), ({'point': [1110, 900]}, 'on top')):
            with self.subTest(changes=changes):
                candidate = copy.deepcopy(graph)
                candidate['nodes'][1].update(changes)
                with self.assertRaisesRegex(ValueError, message):
                    persistence.merge_graph_nodes(candidate, {'b': 'a'})
        for aliases in ({'a': 'a'}, {'b': 'a', 'a': 'b'}, {'absent': 'a'}, []):
            with self.assertRaises(ValueError):
                persistence.merge_graph_nodes(graph, aliases)
        with self.assertRaisesRegex(ValueError, 'cannot be merged'):
            persistence.merge_graph_nodes(graph, {'b': 'a'}, protected_ids={'a'})

    def test_pending_internal_connection_becomes_no_self_link(self):
        graph, _ = fixture('GF')
        additions = [{'id': 'B03-GF-admin-internal', 'from': 'b', 'to': 'c', 'floorId': 'GF'},
                     {'id': 'B03-GF-admin-branch', 'from': 'c', 'to': 'north', 'floorId': 'GF'}]
        merged, _ = persistence.edited_graph(graph, {}, [], additions, merges={'b': 'a', 'c': 'a'},
                                             pending_merges={'b': 'a', 'c': 'a'})
        self.assertEqual(len(merged['edges']), 3)
        self.assertEqual(merged['edges'][-1]['from'], 'a')
        persistence.assert_graph(merged, 'GF')

    def test_changed_merge_geometry_cannot_cross_a_wall_or_leave_the_union(self):
        graph, _ = fixture('GF')
        graph['nodes'][0]['point'] = [1100.1, 900]
        graph['nodes'][1]['point'] = [1099.9, 900]
        graph['edges'] = [graph['edges'][0]]
        graph['edges'][0]['to'] = 'b'
        graph['edges'][0]['geometry'][-1] = [1099.9, 900]
        graph['walls'] = [[[1100, 880], [1100, 920]]]
        with self.assertRaisesRegex(ValueError, 'wall'):
            persistence.merge_graph_nodes(graph, {'b': 'a'})
        # The UI sends removed nodes at the survivor's current position. This
        # pre-applied move must not hide a changed segment from the merge gate.
        with self.assertRaisesRegex(ValueError, 'wall'):
            persistence.edited_graph(graph, {'b': [1100.1, 900]}, [], merges={'b': 'a'})
        graph['walls'] = []
        graph['navigableAreas'] = [[[1000, 800], [1100, 800], [1100, 1000], [1000, 1000]]]
        with self.assertRaisesRegex(ValueError, 'not covered'):
            persistence.merge_graph_nodes(graph, {'b': 'a'})

    def test_sequential_aliases_movement_deletion_and_source_links(self):
        graph, links = fixture('01')
        first_merge, _ = persistence.merge_graph_nodes(graph, {'b': 'a'})
        second_merge, info = persistence.merge_graph_nodes(first_merge, {'c': 'a'})
        moved, _ = persistence.edited_graph(second_merge, {'a': [1101, 901]}, [])
        self.assertEqual(moved['edges'][0]['geometry'][-1], [1101, 901])
        self.assertEqual(moved['edges'][1]['geometry'][0], [1101, 901])
        self.assertEqual(persistence.merge_source_links(links, info), links)
        deleted, _ = persistence.edited_graph(moved, {}, ['a'])
        self.assertEqual(deleted['edges'], [])
        persistence.assert_graph(deleted, '01')


class MergeWorkerTests(unittest.TestCase):
    def roundtrip(self, floor_id):
        worker = gf if floor_id == 'GF' else first
        graph, links = fixture(floor_id)
        config = {'corridorSpines': [[[1050, 900], [1100, 900]], [[1100, 900], [1150, 900]]],
                  'corridorHalfWidth': 10, 'reviewedSpineOverrides': []}
        if floor_id == 'GF':
            config['reviewedConnections'] = []
        floor = {'floor': {'id': floor_id, 'viewBox': [1000, 800, 200, 200]},
                 'rooms': [], 'kiosks': []}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = {worker.CONFIG: config, worker.GRAPH: graph,
                     'data/buildings/B03/' + floor_id + '.json': floor,
                     'artifacts/navigation-v2/reconstruction-report.json': {'edgeEvidence': links}}
            if floor_id == 'GF':
                names[gf.BASE] = config
                names[gf.RUNTIME_GRAPH] = graph
            else:
                names[first.REVIEW] = {}
                names[first.TOPOLOGY] = {}
            for name, data in names.items():
                persistence.atomic(root / name, persistence.encoded(data))
            snapshot = {'schemaVersion': 1, 'buildingId': 'B03', 'floorId': floor_id,
                        'revision': 'initial', 'graph': graph, 'config': config, 'sourceLinks': links}
            with patch.dict(os.environ, {'WAYFINDING_NAVIGATION_STORE': str(root / 'navigation.json'),
                                         'WAYFINDING_TRANSITION_STORE': str(root / 'transitions.json')}), \
                    patch.object(worker, 'ROOT', root), patch.object(worker, 'STORE', root / 'editor'):
                persistence.atomic(persistence.snapshot_path(root, floor_id), persistence.encoded(snapshot))
                if floor_id == 'GF':
                    with patch.object(gf.common, 'ROOT', root), \
                            patch.object(gf, 'Evidence', return_value=SimpleNamespace(floor=floor, geometry_diagnostics=[])), \
                            patch.object(gf, 'snapshot', side_effect=lambda _: [
                                {'id': f'spine:{i}', 'index': i, 'kind': 'spine', 'coordinates': line,
                                 'sourceReferences': [f'source:{i}']} for i, line in enumerate(config['corridorSpines'])]), \
                            patch.object(gf, 'prepare', side_effect=lambda *a, **k: (copy.deepcopy(config), [], [])):
                        self.exercise(worker, root, graph, links, floor_id)
                else:
                    self.exercise(worker, root, graph, links, floor_id)

    def exercise(self, worker, root, original, links, floor_id):
        spines = first.spines(worker.read(worker.CONFIG)) if floor_id == '01' else gf.snapshot(None)
        addition = {'id': f'B03-{floor_id}-admin-pending', 'from': 'c', 'to': 'north', 'floorId': floor_id}
        payload = {'revision': worker.revision(), 'floorId': floor_id, 'spines': spines,
                   'nodeMoves': {}, 'explicitNodeMoves': {}, 'deletedNodes': [],
                   'addedEdges': [addition], 'nodeMerges': {'b': 'a', 'c': 'a'}}
        # Real GF preview uses reconstruction only for diagnostics. Keep this
        # bounded synthetic oracle separate from the persisted graph path.
        if floor_id == 'GF':
            import reconstruct_centerline_graph
            with patch.object(reconstruct_centerline_graph, 'reconstruct', return_value=(copy.deepcopy(original), {'edgeEvidence': [], 'approaches': []})), \
                    patch.object(gf, 'Evidence', return_value=SimpleNamespace(
                        floor={'floor': {'id': floor_id, 'viewBox': [1000, 800, 200, 200]},
                               'rooms': [], 'kiosks': []},
                        walls=[], domain=gf.common.Polygon(original['navigableAreas'][0]))):
                preview = worker.execute({**payload, 'action': 'preview'})
        else:
            preview = worker.execute({**payload, 'action': 'preview'})
        self.assertEqual(len(preview['graph']['nodes']), 4)
        self.assertEqual(len(preview['graph']['edges']), 3)
        self.assertFalse(preview['saved'] if 'saved' in preview else False)
        for action in ('draft', 'candidate'):
            candidate = worker.execute({**payload, 'action': action})
            restored = worker.execute({'action': 'restore', 'revision': payload['revision'],
                                       'floorId': floor_id, 'candidate': candidate['candidate']})
            self.assertEqual(restored['nodeMerges'], payload['nodeMerges'])
            self.assertEqual(restored['addedEdges'], payload['addedEdges'])
            self.assertEqual(restored['nodeMoves'], {})
        candidate_path = worker.STORE / (candidate['candidate'] + '.json')
        malformed = json.loads(candidate_path.read_text('utf-8'))
        malformed['nodeMerges'] = {'absent': 'a'}
        persistence.atomic(candidate_path, persistence.encoded(malformed))
        with self.assertRaisesRegex(ValueError, 'targets are absent'):
            worker.execute({'action': 'restore', 'revision': payload['revision'],
                            'floorId': floor_id, 'candidate': candidate['candidate']})
        malformed['nodeMerges'] = payload['nodeMerges']
        persistence.atomic(candidate_path, persistence.encoded(malformed))
        saved = worker.execute({**payload, 'action': 'save'})
        self.assertTrue(saved['saved'])
        self.assertEqual(saved['graph'], preview['graph'])
        for before in original['edges']:
            after = next(e for e in saved['graph']['edges'] if e['id'] == before['id'])
            self.assertEqual(after, {**before, 'from': 'a' if before['from'] == 'b' else before['from']})
        self.assertEqual(saved['sourceLinks'], links)
        persistence.assert_graph(saved['graph'], floor_id)
        with self.assertRaisesRegex(ValueError, 'revision changed'):
            worker.execute({**payload, 'action': 'save'})
        with self.assertRaisesRegex(ValueError, 'candidate revision changed'):
            worker.execute({'action': 'restore', 'revision': worker.revision(),
                            'floorId': floor_id, 'candidate': candidate['candidate']})
        reloaded = worker.execute({'action': 'load'})
        self.assertEqual(reloaded['graph'], saved['graph'])
        again = worker.execute({'action': 'save', 'floorId': floor_id, 'revision': worker.revision(),
                                'spines': spines, 'nodeMoves': {}, 'explicitNodeMoves': {}})
        self.assertEqual(again['graph'], saved['graph'])
        stored = persistence.read_snapshot(root, floor_id)
        self.assertEqual(stored['sourceLinks'], links)
        self.assertEqual(stored['nodeMergeHistory'][0]['aliases'], payload['nodeMerges'])
        self.assertEqual(persistence.read_snapshot(root, 'GF' if floor_id == '01' else '01'), None)

    def test_ground_floor_preview_restore_save_reload(self):
        self.roundtrip('GF')

    def test_first_floor_preview_restore_save_reload(self):
        self.roundtrip('01')


if __name__ == '__main__':
    unittest.main()
