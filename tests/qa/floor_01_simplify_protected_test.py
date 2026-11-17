"""Synthetic regression for explicit node protection during simplification."""
import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/semantic-map'))
from floor_01_graph import simplify_graph


class ProtectedSimplificationTests(unittest.TestCase):
    def graph(self):
        return {
            'nodes': [{'id': key, 'point': [index, 0], 'type': 'junction'}
                      for index, key in enumerate(('left', 'middle', 'right'))],
            'edges': [
                {'id': 'a', 'from': 'left', 'to': 'middle',
                 'geometry': [[0, 0], [1, 0]], 'distance': 1, 'bidirectional': True},
                {'id': 'b', 'from': 'middle', 'to': 'right',
                 'geometry': [[1, 0], [2, 0]], 'distance': 1, 'bidirectional': True},
            ],
        }

    def test_default_still_contracts_unreferenced_degree_two_node(self):
        result, stats = simplify_graph(self.graph())
        self.assertEqual([node['id'] for node in result['nodes']], ['left', 'right'])
        self.assertEqual(stats['contractedNodes'], 1)
        self.assertEqual(result['edges'][0]['geometry'], [[0, 0], [1, 0], [2, 0]])

    def test_explicit_protection_preserves_authored_node_and_input(self):
        graph = self.graph()
        original = copy.deepcopy(graph)
        result, stats = simplify_graph(graph, protected_node_ids={'middle'})
        self.assertEqual(result, original)
        self.assertEqual(graph, original)
        self.assertEqual(stats['contractedNodes'], 0)

    def test_explicit_protection_keeps_existing_room_protection(self):
        graph = self.graph()
        graph['nodes'][1]['roomId'] = 'synthetic-room'
        result, stats = simplify_graph(graph, protected_node_ids=('left',))
        self.assertEqual(result, graph)
        self.assertEqual(stats['contractedNodes'], 0)


if __name__ == '__main__':
    unittest.main()
