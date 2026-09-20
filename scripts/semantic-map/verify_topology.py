"""Compare the exported network with full-circulation shortest-path references.

The oracle is computed before graph reduction; this verifier knows neither the
grid parent trees nor the reduction algorithm. A rooted-tree negative control
ensures this check rejects the original entrance-detour failure.
"""
import heapq
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/buildings/B03'
graph = json.loads((OUT / 'GF.graph.json').read_text(encoding='utf8'))
oracle = json.loads((OUT / 'GF.shortest-paths.review.json').read_text(encoding='utf8'))
floor = json.loads((OUT / 'GF.json').read_text(encoding='utf8'))

def shortest(adjacency, start):
    best = {start: 0.0}
    parents = {}
    queue = [(0.0, start)]
    while queue:
        distance, current = heapq.heappop(queue)
        if distance != best[current]:
            continue
        for target, cost in adjacency[current]:
            candidate = distance + cost
            if candidate < best.get(target, float('inf')):
                best[target] = candidate
                parents[target] = (current, cost)
                heapq.heappush(queue, (candidate, target))
    return best, parents

adjacency = {n['id']: [] for n in graph['nodes']}
for edge in graph['edges']:
    adjacency[edge['from']].append((edge['to'], edge['distance']))
    adjacency[edge['to']].append((edge['from'], edge['distance']))
endpoints = [r['doorNodeId'] for r in floor['rooms']]
costs = {start: shortest(adjacency, start)[0] for start in endpoints}
assert len(oracle['pairs']) == len(endpoints) * (len(endpoints)-1)//2
failures = []
max_ratio = 0.0
for pair in oracle['pairs']:
    actual = costs[pair['start']].get(pair['end'], float('inf'))
    max_ratio = max(max_ratio, actual / pair['distance'])
    if actual > pair['distance'] + .05:
        failures.append({**pair, 'actual': actual})
assert not failures, failures[:10]

root = endpoints[0]
_, parents = shortest(adjacency, root)
tree = {node: [] for node in adjacency}
for node, (parent, cost) in parents.items():
    tree[node].append((parent, cost))
    tree[parent].append((node, cost))
tree_costs = {start: shortest(tree, start)[0] for start in endpoints}
negative_failures = sum(tree_costs[p['start']][p['end']] > p['distance'] + .05 for p in oracle['pairs'])
assert negative_failures > 0, 'The shortest-path oracle must reject entrance-rooted tree reduction'

lab = 'B03-GF-G-43-approach'
prayer = 'B03-GF-G-33-approach'
direct = costs[lab][prayer]
via_entrance = costs[lab][root] + costs[root][prayer]
assert direct < 1000 and direct < via_entrance * .5, (direct, via_entrance)
cycles = len(graph['edges']) - len(graph['nodes']) + 1
assert cycles > 0
report = dict(unorderedPairs=len(oracle['pairs']), orderedPairs=len(oracle['pairs'])*2,
              maximumExportedToFullGridCostRatio=round(max_ratio, 6),
              roundingTolerance=.05, independentCycles=cycles,
              entranceRootedTreeNegativeControlRejectedPairs=negative_failures,
              mechanicalLabToPrayerRoom=dict(distance=round(direct, 4),
                  viaMainEntrance=round(via_entrance, 4), baselineTreeDistance=2833.0013),
              failures=failures)
(OUT / 'GF.topology-validation.review.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
print(json.dumps(report, indent=2))
