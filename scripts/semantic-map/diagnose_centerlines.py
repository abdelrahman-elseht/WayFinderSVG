"""Write deterministic diagnostics for reviewed GF corridor-spine components."""
import json
import math
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, unary_union
from shapely.strtree import STRtree

from explore import ROOT, walls

cfg = json.loads((ROOT / 'scripts/semantic-map/navigation-config.json').read_text(encoding='utf-8'))
floor = json.loads((ROOT / 'data/buildings/B03/GF.json').read_text(encoding='utf-8'))
graph = json.loads((ROOT / 'data/buildings/B03/GF.graph.json').read_text(encoding='utf-8'))
domain = unary_union([Polygon(area) for area in graph['navigableAreas']])
spines = [LineString(spine).intersection(domain) for spine in cfg['corridorSpines']]
pieces = []
def add_lines(geom, owner):
    if geom.geom_type == 'LineString':
        if geom.length > .5: pieces.append((owner, geom))
    elif hasattr(geom, 'geoms'):
        for part in geom.geoms: add_lines(part, owner)
for i, geom in enumerate(spines): add_lines(geom, i)
network = unary_union([line for _, line in pieces])
components = list(network.geoms) if hasattr(network, 'geoms') else [network]
wall_lines = [LineString(wall.coords) for wall in walls]
wall_tree = STRtree(wall_lines)
endpoints = []
for component_id, component in enumerate(components):
    coords = list(component.coords)
    endpoints.extend([(component_id, tuple(coords[0])), (component_id, tuple(coords[-1]))])

def classify(line):
    if not domain.covers(line): return 'outside-walkable-domain'
    hits = wall_tree.query(line)
    if any(line.intersects(wall_lines[i]) for i in hits): return 'wall-contact'
    return 'safe-within-reviewed-corridor-domain'

candidates = []
endpoint_geoms = [Point(point).buffer(cfg['corridorHalfWidth'] * 2) for _, point in endpoints]
endpoint_tree = STRtree(endpoint_geoms)
for i, (a_component, a) in enumerate(endpoints):
    nearby = endpoint_tree.query(Point(a).buffer(cfg['corridorHalfWidth'] * 2))
    for j in nearby:
        if j <= i: continue
        b_component, b = endpoints[int(j)]
        if a_component == b_component: continue
        line = LineString([a,b]); reason = classify(line)
        candidates.append(dict(componentA=a_component, endpointA=[round(v,3) for v in a],
            componentB=b_component, endpointB=[round(v,3) for v in b], distance=round(line.length,3),
            classification=('geometric-tolerance-or-intersection' if line.length <= 3 and reason.startswith('safe')
                else 'missing-corridor-connection' if line.length <= cfg['corridorHalfWidth'] and reason.startswith('safe')
                else 'unresolved-or-intentional-separation' if not reason.startswith('safe') else 'long-safe-candidate'),
            validation=reason))
candidates.sort(key=lambda row:(row['distance'],row['componentA'],row['componentB'],row['endpointA']))
out = ROOT / 'artifacts/navigation-v2'; out.mkdir(parents=True, exist_ok=True)
report = dict(schemaVersion=1, floor='B03/GF', method='Configured corridor spines clipped to walkable regions; unary_union nodes intersections',
    components=len(components), componentLengths=[round(c.length,3) for c in components],
    clippedSpineParts=len(pieces), pairCandidateCount=len(candidates), candidates=candidates,
    roomApproaches=len([r for r in floor['rooms'] if r.get('doorNodeId')]),
    restrictions='No connection accepted unless complete line is covered by the walkable domain and wall-clear.')
(out/'connectivity-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
minx,miny,maxx,maxy=domain.bounds; width=maxx-minx;height=maxy-miny
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx} {miny} {width} {height}"><rect x="{minx}" y="{miny}" width="{width}" height="{height}" fill="#f9fafb"/>']
for index,component in enumerate(components):
    color=f'hsl({(index*137.508)%360:.2f} 72% 42%)'; pts=' '.join(f'{x},{y}' for x,y in component.coords)
    svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="4"/><text x="{component.coords[0][0]}" y="{component.coords[0][1]}" fill="{color}" font-size="20">C{index}</text>')
for rank,item in enumerate(candidates[:250]):
    x,y=item['endpointA']; x2,y2=item['endpointB']; color='#159447' if item['validation'].startswith('safe') else '#d62728'
    svg.append(f'<line x1="{x}" y1="{y}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-opacity=".3" stroke-width="1"/>')
svg.append('</svg>')
(out/'spine-components.svg').write_text('\n'.join(svg),encoding='utf-8')
print(json.dumps(dict(components=len(components),pieces=len(pieces),candidates=len(candidates),
    safe=sum(c['validation'].startswith('safe') for c in candidates),report=str(out/'connectivity-diagnostics.json'),visual=str(out/'spine-components.svg'))))
