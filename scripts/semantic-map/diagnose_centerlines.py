"""Account for every configured spine, clipped descendant and proposed join."""
import json
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
from centerline_common import Evidence, OUT, parts, stable_id, write

def diagnose():
    e = Evidence()
    raw_network = unary_union(e.raw)
    clipped = e.spine_pieces()
    lines = sorted(parts(unary_union([line for _, line in clipped])), key=lambda line: tuple(line.coords))
    components = []
    for line in lines:
        owners = [i for i, raw in enumerate(e.raw) if raw.buffer(1e-8).covers(line)]
        coordinates = list(map(list, line.coords))
        components.append({'id': stable_id('C-', coordinates), 'sourceSpineIds': owners,
            'coordinates': coordinates, 'length': line.length, 'tests': e.tests(line), 'sourceReferences': e.references(owners)})
    raw_components = []
    for line in parts(raw_network):
        coordinates = list(map(list, line.coords))
        owners = [i for i, raw in enumerate(e.raw) if raw.buffer(1e-8).covers(line)]
        raw_components.append({'id': stable_id('R-', coordinates), 'sourceSpineIds': owners,
            'coordinates': coordinates, 'length': line.length,
            'clippedDescendantIds': [c['id'] for c in components if line.buffer(1e-8).intersection(LineString(c['coordinates'])).length > 1e-8]})
    endpoints = [(c, p) for c in components for p in (c['coordinates'][0], c['coordinates'][-1])]
    radius = e.cfg['corridorHalfWidth'] * 2
    tree = STRtree([Point(p) for _, p in endpoints])
    candidates = []
    for i, (a, p) in enumerate(endpoints):
        for j in sorted(map(int, tree.query(Point(p).buffer(radius)))):
            b, q = endpoints[j]
            if j <= i or a['id'] == b['id'] or Point(p).distance(Point(q)) > radius: continue
            line = LineString([p, q]); tests = e.tests(line); same_point = p == q
            classification = ('existing-source-junction' if same_point else 'numerical-near-miss' if line.length <= .0001
                else 'missing-corridor-connection' if tests['safe'] else 'unresolved-source-evidence')
            owners = sorted(set(a['sourceSpineIds'] + b['sourceSpineIds']))
            candidates.append({'id': stable_id('J-', [a['id'], b['id'], p, q]), 'componentA': a['id'], 'componentB': b['id'],
                'endpointA': p, 'endpointB': q, 'distance': line.length, 'classification': classification, 'tests': tests,
                'validation': 'safe' if tests['safe'] else 'rejected-geometry',
                'decision': 'existing-junction' if same_point and tests['safe'] else 'not-authorized',
                'reason': 'Configured spines already share this point.' if same_point else 'Source review required; containment alone does not establish a passage.',
                'sourceReferences': e.references(owners)})
    candidates.sort(key=lambda c: (c['distance'], c['id']))
    gaps, spines = [], []
    for i, raw in enumerate(e.raw):
        ids = []
        for line in parts(raw.difference(e.domain)):
            coords = list(map(list, line.coords)); tests = e.tests(line)
            gap = {'id': stable_id('GAP-', [i, coords]), 'sourceSpineIds': [i], 'coordinates': coords, 'distance': line.length, 'tests': tests,
                'classification': 'numerical-near-miss' if line.length <= .0001 and not tests['wallIndices'] and not tests['roomInteriors'] else 'unresolved-source-evidence',
                'decision': 'excluded', 'reason': 'Configured spine leaves exact navigable union; no replacement connection is inferred.', 'sourceReferences': e.references([i])}
            gaps.append(gap); ids.append(gap['id'])
        spines.append({'id': f'S-{i:02}', 'index': i, 'coordinates': list(map(list, raw.coords)), 'length': raw.length,
            'clippedDescendantIds': [c['id'] for c in components if i in c['sourceSpineIds']], 'excludedGapIds': ids, 'sourceReferences': e.references([i])})
    report = {'schemaVersion': 2, 'floor': 'B03/GF', 'configuredSpines': spines, 'rawNodedLinePieces': raw_components,
        'components': components, 'gaps': gaps, 'candidateRadiusMapUnits': radius, 'pairCandidateCount': len(candidates), 'candidates': candidates,
        'counts': {'configuredSpines': len(spines), 'rawNodedLinePieces': len(raw_components), 'clippedSpineParts': len(clipped),
            'clippedNodedLinePieces': len(components), 'excludedGaps': len(gaps), 'safeCandidateConnections': sum(c['tests']['safe'] for c in candidates)},
        'restrictionPolicy': 'Unknown access/accessibility preserved; no automatic cross-component chord approval.',
        'terminology': 'Line pieces are not connected components. Previous hardcoded 31 raw count was incorrect.'}
    write('connectivity-diagnostics.json', report)
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="650 500 3100 1550">', '<rect x="650" y="500" width="3100" height="1550" fill="white"/>']
    for i, c in enumerate(components):
        color = f'hsl({i * 137.508 % 360:.2f} 70% 35%)'; points = ' '.join(f'{x},{y}' for x, y in c['coordinates'])
        svg.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="3"><title>{c["id"]}</title></polyline>')
        for x, y in (c['coordinates'][0], c['coordinates'][-1]): svg.append(f'<circle cx="{x}" cy="{y}" r="3" fill="{color}"/>')
        x, y = LineString(c['coordinates']).interpolate(.5, normalized=True).coords[0]
        svg.append(f'<text x="{x}" y="{y}" font-size="9" fill="{color}">{c["id"]}</text>')
    svg.append('</svg>'); (OUT / 'spine-components.svg').write_text('\n'.join(svg), encoding='utf-8')
    print(json.dumps(report['counts'])); return report

if __name__ == '__main__': diagnose()
