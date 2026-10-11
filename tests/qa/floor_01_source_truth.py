"""Independent First Floor truth checks; no generator imports or grid oracle.

Read original PDF/source records and validate exported geometry with Shapely.
Curved walls use 96 subdivisions, independent of the generator's 24 samples.
"""
from pathlib import Path
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import pymupdf
from shapely.geometry import Point, LineString, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
checks = 0


def check(condition, message):
    global checks
    checks += 1
    assert condition, message


def read(path):
    return json.loads((ROOT/path).read_text(encoding='utf8'))


def affine(p, m):
    return [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]]


def sample(item):
    points = item['points']
    if item['type'] in ('curve', 'cubic'):
        out = []
        for k in range(97):
            t = k/96
            weights = [(1-t)**3, 3*t*(1-t)**2, 3*t*t*(1-t), t**3]
            out.append([sum(weights[i]*points[i][j] for i in range(4)) for j in range(2)])
        return out
    return points + ([points[0]] if item['type'] in ('rect', 'quad') else [])


def main():
    floor = read('data/buildings/B03/01.json'); graph = read('data/buildings/B03/01.graph.json')
    review = read('data/buildings/B03/01.review.json'); contents = read('content/B03/01.json')
    align = read('maps/B03/01/alignment.json'); cfg = read('scripts/semantic-map/floors/01.json')
    schedule = read('maps/B03/01/source/room-schedule.json')['rows']
    expected = {'0001': 'cbcc2829f84f9bb336fb17db0f22d605aeaf710e52a813178e47a66a3f8bda94',
        '0002': '882ed490480ecc66adf01d34affb5b56242a7cc47db30761591098f464f561c2'}
    check(align['viewBox'] == [580, 315, 2910, 1585] and align['seamX'] == 2055, 'Master frame/seam')
    check(align['sources'][0]['displayToMaster'] == [1, 0, 0, 1, 0, 0], 'Sheet 0001 identity')
    check(align['sources'][1]['displayToMaster'] == [.75, 0, 0, .75, 1444.55, 182.41], 'Sheet 0002 affine transform')
    check(len(align['anchors']) == 6 and align['maxAnchorResidual'] == .01271, 'Accepted anchors')
    for anchor in align['anchors']:
        check(math.dist(anchor['source0001'], affine(anchor['source0002'], align['sources'][1]['displayToMaster'])) < .02, 'Independent anchor residual')
    svg = ET.parse(ROOT/'maps/B03/01/master.svg')
    check(len(svg.findall('.//{http://www.w3.org/2000/svg}path')) == 3966, 'Source vector inventory')
    check(not svg.findall('.//{http://www.w3.org/2000/svg}image'), 'No raster architecture')
    for manifest_path, base in [('B03_First_Floor/manifest.json', 'B03_First_Floor'), ('maps/B03/01/manifest.json', 'maps/B03/01')]:
        for name, digest in read(manifest_path)['files'].items():
            check(hashlib.sha256((ROOT/base/name).read_bytes()).hexdigest() == digest, f'Manifest bytes: {base}/{name}')
    raws = {}; original_walls = []; contour_ink = []
    frame = box(580, 315, 3490, 1900)
    for source in align['sources']:
        sid = source['id']; path = ROOT/'B03_First_Floor/source/pdfs'/source['file']
        check(hashlib.sha256(path.read_bytes()).hexdigest() == expected[sid], 'Immutable PDF hash')
        raw = read(f'maps/B03/01/source/{sid}.json'); raws[sid] = raw
        check(raw == read(f'B03_First_Floor/source/{sid}.json'), 'Unchanged full extraction IDs/coordinates')
        with pymupdf.open(path) as pdf:
            check(len(pdf) == 1 and pdf[0].rotation == 270, 'Original page identity')
            original_text = ' '.join(pdf[0].get_text().split())
            if sid == '0001':
                for row in schedule:
                    check(row['code'] in original_text and ' '.join(row['name'].split()) in original_text, f'Original PDF schedule row {row["code"]}')
        crop = source['planCrop']; m = source['displayToMaster']
        corners = [affine(crop[:2], m), affine(crop[2:], m)]
        retained = box(*corners[0], *corners[1]).intersection(frame).intersection(box(580 if sid == '0001' else 2055, 315, 2055 if sid == '0001' else 3490, 1900))
        for path_record in raw['paths']:
            if path_record['layer'] not in cfg['wallLayers'] + cfg['doorLayers']:
                continue
            for item in path_record['items']:
                transformed = {**item, 'points': [affine(p, m) for p in item['points']]}
                line = LineString(sample(transformed)).intersection(retained)
                if not line.is_empty:
                    contour_ink.append(line)
                    if path_record['layer'] in cfg['wallLayers']:
                        original_walls.append(line)
    check([r['code'] for r in schedule] == [f'F-{n:02}' for n in range(1, 60)], '59 ordered schedule identities')
    check(len(review['rooms']) == 59 and len({r['code'] for r in review['rooms']}) == 59, 'One reconciliation per schedule entry')
    exceptions = [r for r in review['rooms'] if r['status'] == 'source-status-exception']
    check({r['code'] for r in exceptions} == {'F-10', 'F-18', 'F-28', 'F-29', 'F-45'}, 'Individually recorded source gaps')
    for record in exceptions:
        check(not record['planLabels'] and record['labelPosition'] is None and record['roomId'] is None, 'No invented exception coordinates')
    check(len(floor['rooms']) == 54 and review['directoryCount'] == 54, 'Actual directory count')
    check({r['id'] for r in contents} == {r['contentRef'] for r in floor['rooms']}, 'One-to-one content')
    check(all(c['placeholder'] and c['image'] is None and all(c['description'].values()) for c in contents), 'Honest content')
    check(floor['floor']['metersPerUnit'] is None and graph['metersPerUnit'] is None and 'navigationDefaults' not in floor, 'No metric/kiosk/default invention')
    check(all(k['nodeId'] is None and k['status'] == 'unknown' for k in floor['kiosks']), 'Unconfigured local kiosks')
    check(graph['routingPolicy'] == 'drawing-based' and graph['status'] == 'candidate', 'Evidence policy')
    # Check closures against actual leaf ends and swing ends, independently of
    # the generator's tangent-intersection calculation. Then check each complete
    # display boundary against dense source ink plus those supported closures.
    for seal in review['doorGapCandidates']:
        sid = seal['sourceId']; matrix = next(s['displayToMaster'] for s in align['sources'] if s['id'] == sid)
        paths = {p['id']: p for p in raws[sid]['paths']}
        arc = paths[seal['arcPathId']]; leaf = paths[seal['leafPathId']]
        pivot, closed = seal['sourceDoorSegment']
        ends = [affine(p, matrix) for item in leaf['items'] if item['type'] not in ('curve','cubic') for p in item['points']]
        swing_ends = [affine(p, matrix) for item in arc['items'] if item['type'] in ('curve','cubic') for p in (item['points'][0],item['points'][-1])]
        check(min(math.dist(pivot,p) for p in ends) < 2, 'Closure pivot is source leaf evidence')
        check(min(math.dist(closed,p) for p in swing_ends) < .001, 'Closure end is source swing evidence')
        contour_ink.append(LineString(seal['segment']))
    source_contour_tree = STRtree(contour_ink)
    polygons = []; by_node = {n['id']: n for n in graph['nodes']}
    for room in floor['rooms']:
        record = next(r for r in review['rooms'] if r['code'] == room['code'])
        label = next(l for l in record['planLabels'] if l['id'] == record['selectedLabelId'])
        source = next(s for s in align['sources'] if s['id'] == label['sourceId'])
        texts = {t['id']: t for t in raws[label['sourceId']]['texts']}
        text = texts[label['id']]; bbox = text['bbox']
        anchor = affine([(bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2], source['displayToMaster'])
        check(math.dist(anchor, room['centroid']) < .001 and frame.covers(Point(anchor)), 'Independent transformed label marker')
        row = next(r for r in schedule if r['code'] == room['code'])
        check(room['name']['en'] == row['name'] and room['name']['ar'], 'Unrewritten schedule/editorial translation')
        check(room['geometryStatus'] == ('candidate' if room['polygon'] else 'unknown'), 'Geometry confidence')
        if room['polygon']:
            polygon = Polygon(room['polygon'])
            check(polygon.is_valid and frame.covers(polygon) and polygon.covers(Point(anchor)), 'Valid closed contour/label/bounds')
            local_ink = [contour_ink[i] for i in source_contour_tree.query(polygon.boundary.buffer(.5))]
            check(unary_union(local_ink).buffer(.5).covers(polygon.boundary), f'Complete contour boundary follows source ink: {room["code"]}')
            for code, other in polygons:
                check(polygon.intersection(other).area < 1, 'Distinct nonoverlapping room solids')
            polygons.append((room['code'], polygon))
        if room['doorNodeId']:
            node = by_node[room['doorNodeId']]
            connection = next(c for c in review['graphReview']['candidateConnections'] if c['roomId'] == room['id'])
            check(node['point'] == connection['point'] and node['id'] == room['doorNodeId'], 'Endpoint evidence matches graph')
            if connection['arcPathId']:
                check(node.get('roomId') == room['id'], 'Door approach belongs to its room')
            else:
                check(node['type'] == 'junction' and room['category'] == 'circulation', 'Source circulation approach reuses a retained junction')
            check(math.dist(node['point'], room['centroid']) > .001, 'No room-centroid endpoint')
            check(all(room['navigationNote'].values()), 'Bilingual approach qualification')
            if connection['arcPathId']:
                raw_paths = {p['id']: p for p in raws[connection['arcPathId'][:4]]['paths']}
                check(connection['arcPathId'] in raw_paths and connection['leafPathId'] in raw_paths, 'Actual swing/leaf IDs')
    original_wall_union = unary_union(original_walls)
    supplied_walls = unary_union([LineString(w) for w in graph['walls']])
    areas = unary_union([Polygon(p) for p in graph['navigableAreas']])
    investigation = unary_union([LineString(p).buffer(cfg['corridorHalfWidth'], cap_style=2, join_style=2) for p in cfg['corridorSpines']])
    # The generator supports short source-door landings beyond the main traces.
    # Verify their provenance against the independently checked swing/leaf
    # portals above, then include their bounded envelope. Every retained edge
    # still has to avoid ALL original walls and room/stair solids below.
    topology = read('data/buildings/B03/01.shortest-paths.review.json')
    for bridge in topology['landingBridges']:
        seal = next(s for s in review['doorGapCandidates'] if s['arcPathId'] == bridge['arcPathId'])
        portal = LineString(seal['sourceDoorSegment'])
        path = LineString(bridge['points'])
        check(portal.distance(Point(bridge['points'][0])) <= 22.01, 'Landing starts at a source threshold or its corridor-side approach')
        check(path.length <= cfg['corridorHalfWidth'] * 16, 'Landing has bounded local extent')
        check(0 < bridge['halfWidth'] <= cfg['corridorHalfWidth'], 'Landing cannot widen the corridor allowance')
        check(frame.covers(path), 'Landing stays in the source frame')
        # Bent connectors may end at an earlier source landing; all extensions
        # must meet the already established investigation envelope.
        check(investigation.buffer(.02).intersects(path), 'Landing joins reviewed circulation')
        landing = path.buffer(bridge['halfWidth'], cap_style=2, join_style=2)
        investigation = investigation.union(landing)
    for node in graph['nodes']:
        check(node['buildingId'] == 'B03' and node['floorId'] == '01' and node['status'] == 'candidate', 'Floor-local node evidence')
        check(areas.buffer(.0002).covers(Point(node['point'])) and not original_wall_union.intersects(Point(node['point'])), 'Safe source endpoint')
    for edge in graph['edges']:
        line = LineString(edge['geometry'])
        check(edge['from'] != edge['to'] and line.length > 0, 'Positive non-self edge')
        check(edge['geometry'][0] == by_node[edge['from']]['point'] and edge['geometry'][-1] == by_node[edge['to']]['point'], 'Exact edge endpoints')
        check(edge['floorId'] == '01' and edge['distanceUnit'] == 'map-unit' and abs(edge['distance']-line.length) < .001, 'Declared drawing length/floor')
        check(areas.buffer(.0002).covers(line) and frame.covers(line) and investigation.buffer(.02).covers(line), 'Full-segment union/envelope coverage')
        check(not line.intersects(supplied_walls) and not line.intersects(original_wall_union), 'Zero contact with supplied AND original dense source walls')
        for code, polygon in polygons:
            if code not in cfg['circulationCodes']:
                check(not line.intersects(polygon), 'No non-circulation room shortcut')
        check(edge['status'] == 'candidate' and edge['accessibility'] == 'unknown' and edge['restriction'] == 'unknown', 'Honest access metadata')
    report = dict(status='passed', assertions=checks, scheduleEntries=59, rooms=54, sourceStatusExceptions=[r['code'] for r in exceptions],
        candidateContours=len(polygons), nodes=len(graph['nodes']), edges=len(graph['edges']), supportedApproaches=sum(r['doorNodeId'] is not None for r in floor['rooms']),
        originalWallCurveSubdivisions=96, wallContacts=0, roomShortcuts=0, calibration='unknown', physicalAccess='unverified')
    out = ROOT/'artifacts/qa/floor-01'; out.mkdir(parents=True, exist_ok=True)
    (out/'source-truth.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
