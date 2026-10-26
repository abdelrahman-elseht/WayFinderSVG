"""Strict, non-promoting safety/connectivity audit for the V2 diagnostic graph."""
import json
from pathlib import Path

from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
graph = json.loads((ROOT / 'artifacts/navigation-v2/GF.v2.graph.diagnostic.json').read_text(encoding='utf-8'))
floor = json.loads((ROOT / 'data/buildings/B03/GF.json').read_text(encoding='utf-8'))
cfg = json.loads((ROOT / 'scripts/semantic-map/navigation-config.json').read_text(encoding='utf-8'))
domain = unary_union([Polygon(ring) for ring in graph['navigableAreas']])
walls = [LineString(wall) for wall in graph['walls']]
wall_tree = STRtree(walls)
foyer = Polygon(cfg['sharedAVFoyer']['polygon'])
obstacles = [(room['code'], Polygon(room['polygon']).buffer(-.01).difference(foyer)
              if room['code'] == cfg['sharedAVFoyer']['roomCode'] else Polygon(room['polygon']).buffer(-.01))
             for room in floor['rooms'] if room.get('polygon')]
obstacles.extend((room['code'], Polygon(room['displayFootprint']['polygon']))
                 for room in floor['rooms'] if room.get('displayFootprint'))

bad_area, bad_walls, bad_rooms = [], [], []
for edge in graph['edges']:
    line = LineString(edge['geometry'])
    if not domain.covers(line):
        bad_area.append(edge['id'])
    for idx in wall_tree.query(line):
        if line.intersects(walls[int(idx)]):
            bad_walls.append({'edge': edge['id'], 'wall': int(idx)})
    for code, obstacle in obstacles:
        if line.intersection(obstacle).length > .01:
            bad_rooms.append({'edge': edge['id'], 'room': code})

adj = {node['id']: set() for node in graph['nodes']}
for edge in graph['edges']:
    if edge['from'] in adj and edge['to'] in adj:
        adj[edge['from']].add(edge['to'])
        adj[edge['to']].add(edge['from'])
components = []
unseen = set(adj)
while unseen:
    seed = min(unseen)
    stack, component = [seed], set()
    while stack:
        node = stack.pop()
        if node in component:
            continue
        component.add(node)
        stack.extend(adj[node] - component)
    unseen -= component
    components.append(component)
approaches = [(room['code'], room.get('doorNodeId')) for room in floor['rooms'] if room.get('doorNodeId')]
approaches_by_component = [sorted(code for code, node_id in approaches if node_id in comp) for comp in components]
approaches_by_component.sort(key=lambda row: (-len(row), row))
known_nodes = set(adj)
attached = [code for code, node_id in approaches if node_id in known_nodes]
missing = [code for code, node_id in approaches if node_id not in known_nodes]
report = {
    'graph': 'diagnostic-only; not runtime data',
    'nodes': len(graph['nodes']), 'edges': len(graph['edges']),
    'connectedComponents': len(components),
    'componentNodeCounts': sorted((len(c) for c in components), reverse=True),
    'approachCount': len(approaches),
    'approachesAttachedToGraph': len(attached),
    'approachesMissingFromGraph': missing,
    'approachesInLargestComponent': len(approaches_by_component[0]) if approaches_by_component else 0,
    'approachComponents': approaches_by_component,
    'strictWalkableAreaFailures': bad_area,
    'wallContacts': bad_walls,
    'roomInteriorCrossings': bad_rooms,
    'acceptance': 'FAIL' if bad_area or bad_walls or bad_rooms or len(components) != 1 or len(attached) != 54 else 'PASS',
}
out = ROOT / 'artifacts/navigation-v2/candidate-validation.json'
out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
