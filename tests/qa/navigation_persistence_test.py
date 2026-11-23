"""Isolated persistence transactions; never writes canonical repository outputs."""
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/semantic-map'))
import navigation_persistence as persistence


class NavigationPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        environment = patch.dict(os.environ, {}, clear=False)
        environment.start()
        self.addCleanup(environment.stop)
        os.environ.pop('WAYFINDING_NAVIGATION_STORE', None)

    def snapshot(self, floor_id, revision):
        return {'schemaVersion': 1, 'buildingId': 'B03', 'floorId': floor_id,
                'revision': revision, 'graph': {'nodes': [], 'edges': []}, 'config': {}}

    def test_floor_isolation_and_backups(self):
        gf = self.root / 'data/GF.graph.json'
        gf.parent.mkdir()
        gf.write_bytes(b'dirty GF bytes')
        source = self.root / 'data/01.graph.json'
        source.write_bytes(b'old 01 bytes')
        store = self.root / 'editor'
        with persistence.locked(self.root, '01'):
            backup = persistence.commit(self.root, '01', store, [(source, b'new 01 bytes')],
                                        self.snapshot('01', 'published'))
        self.assertEqual(gf.read_bytes(), b'dirty GF bytes')
        self.assertEqual((store / backup / 'data/01.graph.json').read_bytes(), b'old 01 bytes')
        self.assertEqual(persistence.read_snapshot(self.root, '01')['revision'], 'published')
        self.assertIsNone(persistence.read_snapshot(self.root, 'GF'))

    def test_exception_rolls_back_source_and_snapshot(self):
        source = self.root / 'source.json'
        source.write_bytes(b'before')
        original = persistence.atomic
        target = persistence.snapshot_path(self.root, '01')
        def fail_publication(destination, data):
            if destination == target:
                raise OSError('simulated replacement failure')
            original(destination, data)
        with persistence.locked(self.root, '01'), patch.object(persistence, 'atomic', side_effect=fail_publication):
            with self.assertRaisesRegex(OSError, 'replacement'):
                persistence.commit(self.root, '01', self.root / 'editor', [(source, b'after')],
                                   self.snapshot('01', 'failed'))
        self.assertEqual(source.read_bytes(), b'before')
        self.assertFalse(target.exists())
        self.assertFalse(Path(str(target) + '.recovery.json').exists())

    def test_interruption_journal_recovers_on_next_lock(self):
        source = self.root / 'source.json'
        source.write_bytes(b'before')
        original = persistence.atomic
        original_recover = persistence.recover
        target = persistence.snapshot_path(self.root, '01')
        def fail_publication(destination, data):
            if destination == target:
                raise OSError('interrupted')
            original(destination, data)
        with persistence.locked(self.root, '01'):
            with patch.object(persistence, 'atomic', side_effect=fail_publication), \
                    patch.object(persistence, 'recover', side_effect=OSError('worker terminated')):
                with self.assertRaises(OSError):
                    persistence.commit(self.root, '01', self.root / 'editor', [(source, b'partial')],
                                       self.snapshot('01', 'failed'))
        self.assertEqual(source.read_bytes(), b'partial')
        with persistence.locked(self.root, '01'):
            self.assertEqual(source.read_bytes(), b'before')
        self.assertIs(persistence.recover, original_recover)

    def test_configured_target_is_floor_scoped(self):
        os.environ['WAYFINDING_NAVIGATION_STORE'] = str(self.root / 'durable/live.json')
        self.assertEqual(persistence.snapshot_path(self.root, 'GF'), self.root / 'durable/live.json')
        self.assertEqual(persistence.snapshot_path(self.root, '01'), self.root / 'durable/live.json.01')

    def test_transition_pair_option_disappears_after_the_second_landing_is_published(self):
        transition_node = {
            'id': 'B03-GF-admin-node-lift', 'buildingId': 'B03', 'floorId': 'GF',
            'point': [5, 5], 'type': 'elevator', 'status': 'candidate',
            'transitionId': 'B03-transition-lift', 'transitionName': 'Service lift',
            'transitionAccessibility': 'confirmed', 'transitionRestriction': 'open',
        }
        ground = self.snapshot('GF', 'ground')
        ground['graph'] = {'nodes': [transition_node], 'edges': []}
        persistence.atomic(persistence.snapshot_path(self.root, 'GF'), persistence.encoded(ground))

        available = persistence.transition_candidates(self.root, '01', {'nodes': []})
        self.assertEqual(available, [{key: transition_node[key] for key in (
            'transitionId', 'transitionName', 'type', 'transitionAccessibility',
            'transitionRestriction', 'floorId', 'id') }])

        paired_node = {**transition_node, 'id': 'B03-01-admin-node-lift', 'floorId': '01'}
        self.assertEqual(persistence.transition_candidates(self.root, '01', {'nodes': [paired_node]}), [])

    def test_added_candidate_edge_is_persistable_only_when_supported(self):
        graph = {
            'nodes': [
                {'id': 'a', 'buildingId': 'B03', 'floorId': '01', 'point': [1, 1]},
                {'id': 'b', 'buildingId': 'B03', 'floorId': '01', 'point': [9, 9]},
            ],
            'edges': [],
            'metersPerUnit': None,
            'navigableAreas': [[[0, 0], [10, 0], [10, 10], [0, 10]]],
            'walls': [[[4, 9], [6, 9]]],
        }
        addition = {'id': 'B03-01-admin-test', 'from': 'a', 'to': 'b', 'floorId': '01'}
        result, added = persistence.add_graph_edges(graph, [addition])
        self.assertEqual(len(added), 1)
        self.assertEqual(result['edges'][0]['geometry'], [[1, 1], [9, 9]])
        self.assertEqual(result['edges'][0]['accessibility'], 'unknown')
        self.assertEqual(result['edges'][0]['status'], 'candidate')
        persistence.assert_graph(result, '01')
        self.assertEqual(graph['edges'], [])
        snapshot = self.snapshot('01', 'edge-revision')
        snapshot['graph'] = result
        with persistence.locked(self.root, '01'):
            persistence.commit(self.root, '01', self.root / 'editor', [], snapshot)
        self.assertEqual(persistence.read_snapshot(self.root, '01')['graph']['edges'], result['edges'])
        with self.assertRaisesRegex(ValueError, 'already connected'):
            persistence.add_graph_edges(result, [{**addition, 'id': 'B03-01-admin-duplicate'}])
        with self.assertRaisesRegex(ValueError, 'same-floor'):
            persistence.add_graph_edges(graph, [{**addition, 'to': 'a'}])
        with self.assertRaisesRegex(ValueError, 'wall'):
            persistence.add_graph_edges({**graph, 'walls': [[[4, 6], [6, 4]]]},
                                        [{**addition, 'id': 'B03-01-admin-wall'}])
        outside = {**graph, 'navigableAreas': [[[0, 0], [5, 0], [5, 10], [0, 10]]]}
        with self.assertRaisesRegex(ValueError, 'not covered'):
            persistence.add_graph_edges(outside, [addition])

    def test_area_subtraction_holes_survive_serialization_and_review_can_restore_original_support(self):
        graph = {
            'nodes': [{'id': 'a', 'buildingId': 'B03', 'floorId': 'GF', 'point': [1, 1]}],
            'edges': [], 'metersPerUnit': None, 'walls': [],
            'navigableAreas': [[[0, 0], [10, 0], [10, 10], [0, 10]]],
        }
        context = {'sourceReferences': {'maps/B03/GF/master.svg'},
                   'floor': {'floor': {'id': 'GF', 'viewBox': [0, 0, 10, 10]}}}
        edit = {'id': 'mask-1', 'operation': 'subtract',
                'polygon': [[4, 4], [6, 4], [6, 6], [4, 6]],
                'sourceReference': 'maps/B03/GF/master.svg', 'note': 'Source drawing void review'}
        changed = persistence.apply_area_edits(graph, [edit], context=context)
        from shapely.geometry import Point, Polygon
        from shapely.ops import unary_union
        shape = unary_union([Polygon(ring) for ring in changed['navigableAreas']])
        self.assertFalse(shape.covers(Point(5, 5)))
        self.assertTrue(shape.covers(Point(2, 2)))
        reloaded = persistence.json.loads(persistence.json.dumps(changed))
        reloaded_shape = unary_union([Polygon(ring) for ring in reloaded['navigableAreas']])
        self.assertFalse(reloaded_shape.covers(Point(5, 5)))
        restored = persistence.apply_area_edits(reloaded, [{
            **edit, 'id': 'mask-2', 'operation': 'add'
        }], context=context)
        restored_shape = unary_union([Polygon(ring) for ring in restored['navigableAreas']])
        self.assertTrue(restored_shape.covers(Point(5, 5)))
        self.assertFalse(reloaded_shape.covers(Point(5, 5)))
        with self.assertRaisesRegex(ValueError, 'room or void'):
            persistence.apply_area_edits(reloaded, [{
                **edit, 'id': 'mask-2', 'operation': 'add'
            }], context={**context, 'exclusions': [edit['polygon']]})

    def test_candidate_nodes_bind_room_with_review_and_preserve_endpoint_history(self):
        floor = {'floor': {'id': '01', 'viewBox': [0, 0, 10, 10]},
                 'rooms': [{'id': 'room-1', 'floorId': '01', 'doorNodeId': None}]}
        graph = {'routingPolicy': 'drawing-based', 'metersPerUnit': None,
                 'navigableAreas': [[[0, 0], [10, 0], [10, 10], [0, 10]]],
                 'walls': [], 'nodes': [
                     {'id': 'junction', 'buildingId': 'B03', 'floorId': '01', 'point': [2, 2],
                      'type': 'junction', 'status': 'candidate'},
                 ], 'edges': []}
        payload = {
            'addedNodes': [{'id': 'B03-01-admin-node-entry', 'buildingId': 'B03', 'floorId': '01',
                            'point': [3, 3], 'type': 'entrance', 'roomId': 'room-1',
                            'status': 'candidate', 'sourceReference': 'source-door-1', 'note': 'Plan review'}],
            'addedEdges': [{'id': 'B03-01-admin-entry-link', 'from': 'B03-01-admin-node-entry',
                            'to': 'junction', 'floorId': '01'}],
            'roomEntryBindings': [{'roomId': 'room-1', 'nodeId': 'B03-01-admin-node-entry',
                                   'sourceReference': 'source-door-1', 'note': 'Reviewed room threshold'}],
        }
        source = {'source-door-1'}
        result, _, updated_floor, _, _ = persistence.authored_overlay(
            graph, floor, payload, {}, [], payload['addedEdges'], {},
            source_references=source)
        node = next(node for node in result['nodes'] if node['type'] == 'entrance')
        self.assertEqual(node['status'], 'candidate')
        self.assertEqual(node['adminReview']['accessibility'], 'unknown')
        self.assertEqual(updated_floor['rooms'][0]['doorNodeId'], node['id'])
        self.assertIn('unverified', updated_floor['rooms'][0]['navigationNote']['en'])
        self.assertTrue(updated_floor['rooms'][0]['navigationPartial'])
        self.assertEqual(updated_floor['rooms'][0]['adminEndpointHistory'][0]['doorNodeId'], None)
        rebound = persistence.apply_room_bindings(updated_floor, result, payload['roomEntryBindings'],
            context={'floor': updated_floor, 'sourceReferences': source})
        self.assertEqual(rebound['rooms'][0]['navigationNote'], updated_floor['rooms'][0]['navigationNote'])
        with self.assertRaisesRegex(ValueError, 'sourceReference'):
            persistence.authored_overlay(graph, floor, {
                **payload, 'addedNodes': [{**payload['addedNodes'][0], 'sourceReference': 'made-up'}]
            }, {}, [], payload['addedEdges'], {}, source_references=source)

    def test_vertical_transition_landing_metadata_is_persisted_with_review_evidence(self):
        floor = {'floor': {'id': '01', 'viewBox': [0, 0, 10, 10]}, 'rooms': []}
        graph = {'routingPolicy': 'drawing-based', 'metersPerUnit': None,
                 'navigableAreas': [[[0, 0], [10, 0], [10, 10], [0, 10]]],
                 'walls': [], 'nodes': [], 'edges': []}
        source = 'maps/B03/01/master.svg'
        transition = {'id': 'B03-01-admin-node-lift', 'buildingId': 'B03', 'floorId': '01',
                      'point': [5, 5], 'type': 'elevator', 'status': 'candidate',
                      'transitionId': 'B03-transition-lift', 'transitionName': 'Service lift',
                      'transitionAccessibility': 'confirmed', 'transitionRestriction': 'open',
                      'sourceReference': source, 'note': 'SYNTHETIC landing review'}
        result, _, _, _, _ = persistence.authored_overlay(
            graph, floor, {'addedNodes': [transition]}, {}, [], [], {},
            source_references={source})
        stored = result['nodes'][0]
        self.assertEqual({key: stored[key] for key in (
            'type', 'transitionId', 'transitionName', 'transitionAccessibility', 'transitionRestriction')}, {
                'type': 'elevator', 'transitionId': 'B03-transition-lift', 'transitionName': 'Service lift',
                'transitionAccessibility': 'confirmed', 'transitionRestriction': 'open'})
        self.assertEqual(result['adminAuthoring']['addedNodes'][0]['adminReview']['status'], 'candidate')

    def test_edge_geometry_edit_keeps_endpoints_and_requires_full_supported_geometry(self):
        graph = {'metersPerUnit': None, 'navigableAreas': [
            [[0, 0], [10, 0], [10, 10], [0, 10]]],
            'walls': [[[5, 0], [5, 4]]],
            'nodes': [{'id': 'a', 'point': [1, 1]}, {'id': 'b', 'point': [9, 1]}],
            'edges': [{'id': 'e', 'from': 'a', 'to': 'b', 'geometry': [[1, 1], [9, 1]],
                       'distanceUnit': 'map-unit', 'distance': 8, 'status': 'candidate',
                       'accessibility': 'unknown'}]}
        request = {'geometry': [[1, 1], [3, 5], [7, 5], [9, 1]],
                   'sourceReference': 'maps/B03/01/master.svg', 'note': 'Reviewed synthetic bend'}
        edited = persistence.edit_edge_geometries(graph, {'e': request}, authoring_context={
            'sourceReferences': {'maps/B03/01/master.svg'}})
        self.assertEqual(edited['edges'][0]['geometry'][0], graph['nodes'][0]['point'])
        self.assertEqual(edited['edges'][0]['geometry'][-1], graph['nodes'][1]['point'])
        self.assertEqual(edited['edges'][0]['status'], 'candidate')
        self.assertEqual(edited['adminAuthoring']['edgeGeometryEdits'][0]['before'], graph['edges'][0])
        with self.assertRaisesRegex(ValueError, 'sourceReference and review note'):
            persistence.edit_edge_geometries(graph, {'e': request['geometry']}, authoring_context={
                'sourceReferences': {'maps/B03/01/master.svg'}})
        with self.assertRaisesRegex(ValueError, 'source frame'):
            persistence.edit_edge_geometries(graph, {'e': request}, authoring_context={
                'sourceReferences': {'maps/B03/01/master.svg'},
                'floor': {'floor': {'viewBox': [0, 0, 10, 4]}}})
        with self.assertRaisesRegex(ValueError, 'wall'):
            persistence.edit_edge_geometries(graph, {'e': {**request, 'geometry': [[1, 1], [5, 2], [9, 1]]}},
                authoring_context={'sourceReferences': {'maps/B03/01/master.svg'}})


if __name__ == '__main__':
    unittest.main()
