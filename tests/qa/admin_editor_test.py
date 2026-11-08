"""Run with python tests/qa/admin_editor_test.py. Real-source checks; writes isolated."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/semantic-map'))
import admin_editor as editor


class EditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.session = editor.bootstrap()

    def payload(self, action='validate'):
        return {'action': action, 'revision': self.session['revision'], 'spines': copy.deepcopy(self.session['spines'])}

    def test_unsafe_saved_source_bootstraps_with_diagnostics(self):
        original_read = editor.common.read
        config = copy.deepcopy(original_read(editor.CONFIG))
        config['reviewedSpineOverrides'] = [{'spineIndex': 0, 'coordinates': [[700, 600], [800, 600]],
                                            'sourceReferences': ['scripts/semantic-map/navigation-config.json']}]
        def read_with_unsafe_source(name):
            return config if name == editor.CONFIG else original_read(name)
        with patch.object(editor.common, 'read', side_effect=read_with_unsafe_source):
            session = editor.bootstrap()
        self.assertEqual(session['spines'][0]['coordinates'], [[700, 600], [800, 600]])
        finding = next(d for d in session['diagnostics'] if d['id'] == 'spine:0')
        self.assertFalse(finding['tests']['safe'])
        self.assertIn('runtimeGraph', session)

    def test_revision_and_coordinates_fail_closed(self):
        payload = self.payload()
        payload['revision'] = 'stale'
        with self.assertRaisesRegex(ValueError, 'revision'):
            editor.execute(payload)
        payload = self.payload()
        payload['spines'][0]['coordinates'][1][0] = float('nan')
        with self.assertRaisesRegex(ValueError, 'finite'):
            editor.execute(payload)

    def test_endpoints_are_editable_and_source_ids_remain_server_owned(self):
        payload = self.payload()
        payload['spines'][0]['coordinates'][0][0] += 1
        result = editor.execute(payload)
        self.assertIn('diagnostics', result)
        payload = self.payload()
        payload['spines'][0]['id'] = '../../arbitrary-file'
        with self.assertRaises(ValueError):
            editor.execute(payload)

    def test_collision_is_reported_without_blocking_candidate(self):
        before = editor.revision()
        payload = self.payload('candidate')
        payload['spines'][0]['coordinates'][1] = [700, 600]
        with tempfile.TemporaryDirectory() as temp, patch.object(editor, 'STORE', Path(temp)):
            result = editor.execute(payload)
        self.assertTrue(result['valid'])
        self.assertTrue(result.get('diagnosticErrors') or result['errors'])
        self.assertEqual(editor.revision(), before)

    def test_unsafe_candidate_is_saved_for_visual_editing_only(self):
        before = editor.revision()
        payload = self.payload('candidate')
        payload['spines'][0]['coordinates'][1] = [700, 600]
        with tempfile.TemporaryDirectory() as temp, patch.object(editor, 'STORE', Path(temp)):
            result = editor.execute(payload)
            self.assertTrue(result['valid'])
            self.assertFalse(result['draftOnly'])
            self.assertFalse(result['routable'])
            saved = json.loads((Path(temp) / (result['candidate'] + '.json')).read_text('utf-8'))
            self.assertFalse(saved['draftOnly'])
            self.assertFalse(saved['routable'])
            self.assertEqual(saved['spines'][0]['coordinates'][1], [700, 600])
            self.assertTrue(result['errors'][0]['nearbyWallIndices'])
            restored = editor.execute({'action': 'restore', 'revision': before, 'candidate': result['candidate']})
            self.assertFalse(restored['routable'])
            self.assertEqual(restored['spines'], payload['spines'])
        self.assertEqual(editor.revision(), before)

    def test_draft_saves_unchecked_geometry_without_touching_source(self):
        before = editor.revision()
        payload = self.payload('draft')
        payload['spines'][0]['coordinates'][1] = [700, 600]
        node_id = self.session['graph']['nodes'][0]['id']
        payload['nodeMoves'] = {node_id: [1200, 900]}
        payload['deletedNodes'] = [node_id]
        with tempfile.TemporaryDirectory() as temp, patch.object(editor, 'STORE', Path(temp)):
            result = editor.execute(payload)
            self.assertTrue(result['draftOnly'])
            self.assertFalse(result['safetyChecked'])
            self.assertFalse(result['routable'])
            self.assertEqual(result['diagnostics'][0]['state'], 'unchecked')
            self.assertIsNone(result['diagnostics'][0]['tests'])
            restored = editor.execute({'action': 'restore', 'revision': before, 'candidate': result['candidate']})
            self.assertEqual(restored['spines'], payload['spines'])
            self.assertEqual(restored['nodeMoves'], payload['nodeMoves'])
            self.assertEqual(restored['deletedNodes'], payload['deletedNodes'])
            self.assertFalse(restored['routable'])
        self.assertEqual(editor.revision(), before)

    def test_preview_reconstructs_unsafe_geometry_for_admin_simulation_only(self):
        before = editor.revision()
        payload = self.payload('preview')
        payload['spines'][2]['coordinates'][3] = [2206.89, 1431.83]
        with patch.object(editor, 'STORE', Path(tempfile.gettempdir()) / 'admin-editor-preview-test'):
            result = editor.execute(payload)
        self.assertTrue(result['draftOnly'])
        self.assertFalse(result['safetyChecked'])
        self.assertIn('graph', result)
        self.assertFalse(result['valid'])
        self.assertEqual(editor.revision(), before)

    def test_reconstruct_and_candidate_are_isolated(self):
        before = editor.revision()
        real_pairs = editor.connectivity_pairs
        calls = 0
        def previous_with_one_extra_pair(graph):
            nonlocal calls
            pairs = real_pairs(graph)
            calls += 1
            return pairs | {('prior-room-a', 'prior-room-b')} if calls == 1 else pairs

        with tempfile.TemporaryDirectory() as temp, patch.object(editor, 'STORE', Path(temp)), patch.object(editor, 'connectivity_pairs', side_effect=previous_with_one_extra_pair):
            result = editor.execute(self.payload('candidate'))
            self.assertTrue(result['valid'], result['errors'])
            self.assertEqual(result['lostRoomPairs'], [('prior-room-a', 'prior-room-b')])
            self.assertEqual(result['requiredRouteFailures'], [])
            self.assertEqual(result['unattachedSupportedRooms'], [])
            self.assertEqual(sum(connection['connected'] for connection in result['roomConnections']), 52)
            self.assertIsInstance(result['validation']['wallContacts'], list)
            self.assertIsInstance(result['validation']['roomInteriorCrossings'], list)
            self.assertEqual(result['validation']['acceptance'], 'FAIL')
            self.assertTrue((Path(temp) / (result['candidate'] + '.json')).exists())
            restored = editor.execute({'action': 'restore', 'revision': before, 'candidate': result['candidate']})
            self.assertEqual(restored['spines'], self.session['spines'])
        self.assertEqual(editor.revision(), before)

    def test_transaction_save_and_backup_in_disposable_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            names = [editor.BASE, editor.CONFIG, editor.GRAPH, 'data/buildings/B03/GF.json',
                     'data/buildings/B03/GF.graph.json', 'artifacts/navigation-v2/reconstruction-report.json']
            for name in names:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes((editor.ROOT / name).read_bytes())
            with patch.object(editor, 'ROOT', root), patch.object(editor.common, 'ROOT', root), patch.object(editor, 'STORE', root / 'artifacts/navigation-editor'):
                payload = self.payload('save')
                payload['revision'] = editor.revision()
                node_id = self.session['graph']['nodes'][0]['id']
                payload['nodeMoves'] = {node_id: [1200, 900]}
                payload['deletedNodes'] = [self.session['graph']['nodes'][1]['id']]
                result = editor.execute(payload)
                self.assertTrue(result['saved'])
                self.assertTrue((editor.STORE / result['backup'] / editor.CONFIG).exists())
                self.assertFalse((editor.STORE / 'recovery.json').exists())
                self.assertEqual(json.loads((root / editor.CONFIG).read_text('utf-8'))['floorId'], 'GF')
                self.assertEqual(next(node for node in result['graph']['nodes'] if node['id'] == node_id)['point'], [1200, 900])
                self.assertNotIn(payload['deletedNodes'][0], {node['id'] for node in result['graph']['nodes']})
                runtime = json.loads((root / editor.RUNTIME_GRAPH).read_text('utf-8'))
                self.assertEqual(next(node for node in runtime['nodes'] if node['id'] == node_id)['point'], [1200, 900])
                self.assertNotIn(payload['deletedNodes'][0], {node['id'] for node in runtime['nodes']})


if __name__ == '__main__':
    unittest.main()
