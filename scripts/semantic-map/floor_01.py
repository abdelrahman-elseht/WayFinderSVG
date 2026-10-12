"""Floor 01 adapter: schedule reconciliation, source contours and route evidence."""
import hashlib
import subprocess
import sys
from pathlib import Path
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor_context import ROOT, read_json, write_json
from source_geometry import load
from floor_01_graph import derive
from display_contours import display_contours
from features import equipment_features

CONFIG = 'scripts/semantic-map/floors/01.json'
OUT = ROOT / 'data/buildings/B03'


def category(name, code, cfg):
    if code in cfg['circulationCodes'] or name.startswith('STAIR'):
        return 'circulation'
    if 'TOILET' in name or 'CHANGING ROOM' in name:
        return 'restroom'
    if 'LAB' in name or 'TRAINING' in name:
        return 'laboratory'
    if name in ('BUSINESS DEVELOPMENT', 'STAFF', 'MEETING ROOM', 'LABS OPERATIONS'):
        return 'office'
    if name in ('STORAGE', 'PANTRY', 'COPY ROOM', 'SERVICES', 'GARBAGE CHUTE', 'VALVE ROOM', 'IT ROOM', 'ELECT ROOM'):
        return 'service'
    return 'other'


def availability(cfg, schedule):
    values = cfg['availability']; codes = {row['code'] for row in schedule}
    assert isinstance(values, dict) and set(values).issubset(codes), 'Unknown floor-owned availability codes'
    for code, value in values.items():
        assert value['status'] in ('available', 'unavailable'), code
        assert all(isinstance(value['reason'].get(lang), str) and value['reason'][lang].strip() for lang in ('en', 'ar')), code
    return values


def generate():
    cfg = read_json(CONFIG); context = load(cfg); labels = context['labels']
    schedule = read_json('maps/B03/01/source/room-schedule.json')['rows']
    overrides = availability(cfg, schedule)
    rooms, contents, review = [], [], []
    for row in schedule:
        code = row['code']; choices = [l for l in labels if l['code'] == code]
        record = dict(code=code, scheduleName=row['name'], scheduleEvidence=row,
            planLabels=choices, sourceLabelIds=[l['id'] for l in choices], conflict=cfg['conflicts'].get(code))
        if not choices:
            record.update(status='source-status-exception', roomId=None, labelPosition=None, geometryStatus='unknown',
                reason='Schedule entry has no source-tagged in-bounds plan label in either supplied sheet. No room/centroid/door invented.')
            review.append(record); continue
        chosen = cfg['labelChoices'].get(code)
        label = next(l for l in choices if l['id'] == chosen) if chosen else min(choices, key=lambda l: (l['sourceId'], l['id']))
        point = [round(v, 3) for v in label['point']]
        inside = [face for face in context['polys'] if face.contains(Point(label['point']))]
        face = inside[0] if len(inside) == 1 else None
        polygon = None
        reason = 'No closed source-vector face contains the plan label; marker only.'
        if face is not None:
            occupants = {l['code'] for l in labels if face.contains(Point(l['point']))}
            if face.area > 400000 or face.intersects(context['frame'].boundary):
                reason = 'Source face connects to exterior/circulation or lacks room closure; marker only.'
            elif occupants != {code}:
                reason = f'Enclosing face has unrelated labels {sorted(occupants)}; marker only.'
            else:
                simple = face.simplify(.18, preserve_topology=True)
                polygon = [[round(x, 3), round(y, 3)] for x, y in simple.exterior.coords[:-1]]
                reason = f'Source wall/door free-space face, 0.20-unit candidate closure buffer and 0.18 simplification. {len(face.interiors)} obstruction holes omitted from display-only outer ring; not walking geometry.'
        rid = 'B03-01-' + code
        provenance = [
            dict(source=f"maps/B03/01/source/{row['sourceId']}.json#{row['nameTextId']}", page=1, status='confirmed', note='Authoritative First Floor schedule name preserved exactly; schedule coordinates are never a map position.'),
            dict(source=f"maps/B03/01/source/{label['sourceId']}.json#{label['id']}", page=1, status='candidate' if code in cfg['conflicts'] else 'confirmed', note=f"Plan label {label['name']!r}, tag {code}. Label bbox center is a marker anchor, not a mathematical centroid or route endpoint. " + cfg['conflicts'].get(code, '')),
            dict(source=CONFIG+'#translations', page=1, status='candidate', note=cfg['translationNotes']),
            dict(source='scripts/semantic-map/source_geometry.py', page=1, status='candidate' if polygon else 'unknown', note=reason)]
        room = dict(id=rid, code=code, buildingId='B03', floorId='01', name=dict(en=row['name'], ar=cfg['translations'][row['name']]),
            category=category(row['name'], code, cfg), polygon=polygon, geometryRef='semantic:'+rid if polygon else None,
            centroid=point, doorNodeId=None, aliases=sorted({row['name'], *[l['name'] for l in choices], code.replace('-', ''), 'F '+code[2:]}),
            contentRef=rid, public=True, geometryStatus='candidate' if polygon else 'unknown', provenance=provenance)
        if code in overrides:
            room['availability'] = overrides[code]
        rooms.append(room)
        contents.append(dict(id=rid, description=dict(en='Verified room information has not been supplied. This is a placeholder; confirm room use and access with academy staff.', ar='لم تُقدَّم معلومات موثقة عن هذا المكان. هذا نص مؤقت؛ يُرجى تأكيد استخدام المكان وإمكانية الدخول إليه مع موظفي الأكاديمية.'),
            placeholder=True, image=None, imageAlt=dict(en='No verified room photograph available', ar='لا تتوفر صورة موثقة للمكان')))
        record.update(status='mapped', roomId=rid, selectedLabelId=label['id'], labelPosition=point,
            geometryStatus=room['geometryStatus'], reason=reason, area=round(face.area, 3) if polygon else None,
            overlapDeduplication='Coincident same-code labels retain both source references; distinct enclosures retain a conflict.' if len(choices) > 1 else None)
        review.append(record)
    polygons = [(r['code'], Polygon(r['polygon'])) for r in rooms if r['polygon']]
    for i, (code, polygon) in enumerate(polygons):
        assert polygon.is_valid and context['frame'].covers(polygon), code
        assert polygon.covers(Point(next(r['centroid'] for r in rooms if r['code'] == code))), code
        for other, op in polygons[i+1:]:
            assert polygon.intersection(op).area < 1, (code, other)
    nodes, edges, areas, connections, missing, topology = derive(rooms, context, cfg)
    display_review = display_contours(rooms, context['paths'], context['seals'], '01', read_json('scripts/semantic-map/display-config.json')['01'])
    segments = sorted({tuple(tuple(round(v, 5) for v in p) for p in (a, b)) for wall in context['walls'] for a, b in zip(wall.coords, list(wall.coords)[1:])})
    floor = dict(schemaVersion=1, building=read_json('scripts/semantic-map/buildings/B03.json'),
        floor=dict(id='01', buildingId='B03', name=cfg['name'], level=1, viewBox=context['align']['viewBox'], mapAsset='/maps/B03/01/master.svg', metersPerUnit=None, calibrationStatus='unknown'),
        rooms=rooms, kiosks=[dict(id='B03-01-kiosk', buildingId='B03', floorId='01', name=dict(en='First Floor Kiosk', ar='كشك الدور الأول'), nodeId=None, status='unknown')], mapFeatures=equipment_features(context['paths'], '01'))
    if cfg['planningOrigin'] is not None:
        assert any(r['id'] == cfg['planningOrigin'] and r['doorNodeId'] for r in rooms)
        floor['navigationDefaults'] = dict(startRoomId=cfg['planningOrigin'])
    graph = dict(nodes=nodes, edges=edges, navigableAreas=areas, walls=segments, metersPerUnit=None, calibrationStatus='unknown', status='candidate' if edges else 'unknown', routingPolicy='drawing-based')
    write_json(OUT/'01.json', floor); write_json(OUT/'01.graph.json', graph); write_json(ROOT/'content/B03/01.json', contents)
    write_json(OUT/'01.shortest-paths.review.json', topology)
    write_json(OUT/'01.review.json', dict(schemaVersion=1, method='Affine source-vector free-space polygonization; source swing/leaf closure evidence; corridor-bounded safe grid network',
        bufferTolerance=.20, simplificationTolerance=.18, displayFootprints=display_review, scheduleCount=59, inventoryCount=len(rooms), directoryCount=sum(r['public'] for r in rooms),
        sourceStatusExceptionCount=59-len(rooms), candidatePolygonCount=len(polygons), confirmedPolygonCount=0, rooms=review,
        translationNotes=cfg['translationNotes'], physicalKiosk='unknown; no default planning origin configured',
        wallEvidence=context['wallEvidence'],
        doorGapCandidates=[dict(arcPathId=s['id'], leafPathId=s['leaf'], sourceId=s['sourceId'], sourceDoorSegment=s['portal'], segment=list(s['line'].coords), status='candidate') for s in context['seals']],
        graphReview=dict(status=graph['status'], candidateConnections=connections, missingRouteRooms=missing,
            reason='Candidate drawing approaches only; all room solids and supplied structural/handrail boundaries excluded. Unknown access/accessibility, disconnected components and source gaps are preserved. No inter-floor connection asserted.'),
        verticalGate='Stair/elevator labels are floor-local evidence only. V1 has no floor-scoped constraints; cross-floor routes remain disabled.'))
    print(f'GENERATED B03/01: {len(rooms)} rooms, {len(polygons)} candidate contours, {len(nodes)} nodes, {len(edges)} edges, {len(missing)} unsupported endpoints')
    print('UNSUPPORTED', [r['code'] for r in missing])


def inspect():
    cfg = read_json(CONFIG); context = load(cfg)
    print('B03/01 source geometry:', len(context['walls']), 'walls,', len(context['seals']), 'swing/leaf closures')
    for label in context['labels']:
        print(label['code'], label['id'], label['point'])


def verify(regenerate=False):
    names = ['data/buildings/B03/01.json', 'data/buildings/B03/01.graph.json', 'data/buildings/B03/01.review.json', 'data/buildings/B03/01.shortest-paths.review.json', 'content/B03/01.json']
    if regenerate:
        before = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names}
        generate()
        after = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in names}
        assert before == after, 'Semantic byte drift'
        write_json(ROOT/'artifacts/qa/floor-01/semantic-inventory.json', dict(first=before, second=after, status='identical'))
    subprocess.run([sys.executable, '-X', 'utf8', str(ROOT/'tests/qa/floor_01_source_truth.py')], cwd=ROOT, check=True)
    verify_navigation()
    subprocess.run([sys.executable, '-X', 'utf8', str(ROOT/'scripts/semantic-map/verify_topology.py'), '--building', 'B03', '--floor', '01'], cwd=ROOT, check=True)


def verify_navigation():
    f, g = read_json('data/buildings/B03/01.json'), read_json('data/buildings/B03/01.graph.json')
    walls = unary_union([LineString(s) for s in g['walls']]); area = unary_union([Polygon(p) for p in g['navigableAreas']])
    badwalls, badareas, badrooms = [], [], []
    obstacles = [(r['code'], Polygon(r['polygon'])) for r in f['rooms'] if r['polygon'] and r['category'] != 'circulation']
    for edge in g['edges']:
        line = LineString(edge['geometry'])
        if line.intersects(walls): badwalls.append(edge['id'])
        if not area.buffer(.0002).covers(line): badareas.append(edge['id'])
        for code, obstacle in obstacles:
            if line.intersects(obstacle): badrooms.append([edge['id'], code])
    report = dict(nodes=len(g['nodes']), edges=len(g['edges']), navAreas=len(g['navigableAreas']), walls=len(g['walls']),
        roomApproaches=sum(r['doorNodeId'] is not None for r in f['rooms']), scheduleEntries=59, orderedSchedulePairs=3481,
        wallContacts=badwalls, areaFailures=badareas, roomInteriorCrossings=badrooms)
    write_json(OUT/'01.navigation-validation.review.json', report)
    assert not badwalls and not badareas and not badrooms, report
    print(report)
