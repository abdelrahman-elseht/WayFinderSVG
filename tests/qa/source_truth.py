"""Independent, read-only source/data QA. Does not regenerate production artifacts."""
from pathlib import Path
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from collections import Counter
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def main():
    checks = []
    def check(condition, label):
        assert condition, label
        checks.append(label)
    align = read('maps/B03/GF/alignment.json')
    manifest = read('maps/B03/GF/manifest.json')
    for name, digest in manifest['files'].items():
        check(hashlib.sha256((ROOT/'maps/B03/GF'/name).read_bytes()).hexdigest() == digest, 'Manifest digest: '+name)
    sources = {s:read('maps/B03/GF/source/'+s+'.json') for s in ['0001','0002']}
    for sid, source in sources.items():
        check(hashlib.sha256((ROOT/source['file']).read_bytes()).hexdigest() == source['sha256'], 'Original PDF hash: '+sid)
        check(source['pageCount'] == 1 and source['pageRotation'] == 270, 'One rotated source page: '+sid)
        check(any('GROUND FLOOR ( B03 ) - PART ' in ' '.join(t['text'].split()) for t in source['texts']), 'Source title identifies ground floor part: '+sid)
    for anchor in align['anchors']:
        master = anchor['source0001']
        translated = [anchor['source0002'][0]+1033.29, anchor['source0002'][1]-28.35]
        check(math.dist(master, translated) < .0002, 'Independent anchor translation: '+anchor['text'])
        for sid,key in [('0001','source0001'),('0002','source0002')]:
            check(any(t['text']==anchor['text'] and t['origin']==anchor[key] for t in sources[sid]['texts']), 'Anchor exists in raw evidence: '+sid+' '+anchor['text'])
    check(align['calibration']['metersPerUnit'] is None, 'No physical scale inferred')
    svg = ET.parse(ROOT/'maps/B03/GF/master.svg')
    paths = [e for e in svg.iter() if e.tag.endswith('}path')]
    raw = {p['id']:p for source in sources.values() for p in source['paths']}
    check(len(paths)>5000, 'Master retains substantial vector architecture')
    check(all(p.attrib['id'] in raw and raw[p.attrib['id']]['layer'] in align['keepLayers'] for p in paths), 'Every displayed vector traces to allowed raw source layer')
    check(not any(e.tag.endswith('}image') for e in svg.iter()), 'Master has no raster substitute')
    schedule = read('maps/B03/GF/source/room-schedule.json')['rows']
    text = {t['id']:t for source in sources.values() for t in source['texts']}
    check([r['code'] for r in schedule] == [f'G-{n:02}' for n in range(1,55)], '54 unique consecutive source schedule codes')
    check(all(text[r['codeTextId']]['text']==r['code'] and text[r['nameTextId']]['text'].strip()==r['name'] for r in schedule), 'Schedule codes and names match raw spans')
    floor = read('data/buildings/B03/GF.json')
    graph = read('data/buildings/B03/GF.graph.json')
    content = read('content/B03/GF.json')
    review = read('data/buildings/B03/GF.review.json')
    check([r['code'] for r in floor['rooms']]==[r['code'] for r in schedule], 'Semantic inventory agrees with source schedule')
    check(len({r['id'] for r in floor['rooms']})==54, 'Room identities unique')
    contents = {c['id']:c for c in content}
    candidates=[]
    for room,row in zip(floor['rooms'],schedule):
        check(room['name']['en'].casefold()==' '.join(row['name'].split()).casefold(), 'Schedule name preserved: '+room['code'])
        check(room['contentRef'] in contents and contents[room['contentRef']]['placeholder'] and contents[room['contentRef']]['image'] is None, 'Unknown content/photo honest: '+room['code'])
        provenance = room['provenance'][1]
        path,tid = provenance['source'].split('#')
        source = sources[tid[:4]]
        bbox = text[tid]['bbox']
        expected = [(bbox[0]+bbox[2])/2+source['displayToMaster'][4], (bbox[1]+bbox[3])/2+source['displayToMaster'][5]]
        check(math.dist(expected,room['centroid']) < .001, 'Label coordinate transformed exactly once: '+room['code'])
        check(room['doorNodeId'] is None or any(n['id']==room['doorNodeId'] and n['status']=='candidate' for n in graph['nodes']), 'No invented confirmed door: '+room['code'])
        if room['polygon']:
            poly=Polygon(room['polygon'])
            check(room['geometryStatus']=='candidate' and poly.is_valid and poly.covers(Point(room['centroid'])), 'Valid candidate encloses its label: '+room['code'])
            candidates.append((room['code'],poly))
        else:
            check(room['geometryStatus']=='unknown', 'Null outline marked unknown: '+room['code'])
    for i,(code,poly) in enumerate(candidates):
        check(all(poly.intersection(other).area < 1 for _,other in candidates[i+1:]), 'No material contour overlap: '+code)
    for code in ['G-08','G-17','G-24','G-25','G-34']:
        check(bool(next(r for r in review['rooms'] if r['code']==code)['conflict']), 'Contradictory source tags documented: '+code)
    check(all(k['nodeId'] is None and k['status']=='unknown' for k in floor['kiosks']), 'Kiosk not invented')
    check(graph['nodes'] and all(n['status']=='candidate' for n in graph['nodes']) and all(e['status']=='candidate' and e['restriction']=='unknown' and e['accessibility']=='unknown' for e in graph['edges']), 'Drawing graph retains candidate source provenance and unknown physical access')
    check(graph.get('routingPolicy')=='drawing-based', 'Drawing policy explicit')
    check(floor.get('navigationDefaults',{}).get('startRoomId')=='B03-GF-G-01', 'Source Main Entrance explicitly configured for planning')
    areas=[Polygon(p) for p in graph['navigableAreas']]
    check(bool(areas) and all(p.is_valid and p.area>0 for p in areas), 'Navigable enclosures are nondegenerate valid polygons')
    enclosure=unary_union(areas)
    walls=[LineString(w) for w in graph['walls']]
    wall_index=STRtree(walls)
    nodes={n['id']:n for n in graph['nodes']}
    for edge in graph['edges']:
        line=LineString(edge['geometry'])
        check(edge['geometry'][0]==nodes[edge['from']]['point'] and edge['geometry'][-1]==nodes[edge['to']]['point'], 'Candidate endpoints agree: '+edge['id'])
        check(abs(line.length-edge['distance']) < .01 and edge['distanceUnit']=='map-unit', 'Length agrees with actual uncalibrated polyline: '+edge['id'])
        check(enclosure.buffer(.00001).covers(line), 'Full route edge contained in area union: '+edge['id'])
        check(not any(line.crosses(walls[int(i)]) or line.overlaps(walls[int(i)]) for i in wall_index.query(line)), 'Route edge neither crosses nor follows a solid wall: '+edge['id'])
        check(all(line.intersection(poly).length < .5 for code,poly in candidates if next(r for r in floor['rooms'] if r['code']==code)['category']!='circulation'), 'Route does not shortcut through a displayed non-circulation room interior: '+edge['id'])
    connections=review['graphReview']['candidateConnections']
    qualifications=[]
    for connection in connections:
        source=connection.get('source',{})
        for key in ['arcPathId','leafPathId']:
            if source.get(key):
                check(source[key] in raw and 'DOOR' in raw[source[key]]['layer'], 'Approach traces to raw door layer: '+connection['roomId']+' '+key)
        room=next(r for r in floor['rooms'] if r['id']==connection['roomId'])
        endpoint=nodes.get(room['doorNodeId'])
        check(endpoint is not None, 'Room has graph endpoint: '+room['code'])
        check(math.dist(endpoint['point'],connection['point'])<.001, 'Review approach matches graph endpoint: '+room['code'])
        boundary_distance=Polygon(room['polygon']).boundary.distance(Point(endpoint['point'])) if room['polygon'] else None
        qualifications.append({'room':room['code'],'kind':connection.get('kind'),'endpoint':endpoint['point'],'roomBoundaryDistance':boundary_distance,'navigationNote':room.get('navigationNote')})
    check(len(connections)==54 and not review['graphReview']['missingRouteRooms'], 'All 54 source destinations have reviewed approach endpoints')
    report = {'status':'passed','checks':len(checks),'inventory':len(floor['rooms']),'candidatePolygons':len(candidates),'confirmedPolygons':0,'liveGraphNodes':len(graph['nodes']),'liveGraphEdges':len(graph['edges']),'liveRouteGeometryValidation':'All graph edges independently checked against supplied solid walls and complete area union; endpoint boundary distances reported separately; physical access is unknown','endpointKinds':dict(Counter(c.get('kind','unknown') for c in connections)),'qualifiedRoomCount':sum(bool(r.get('navigationNote')) for r in floor['rooms']),'endpointQualifications':qualifications,'checksPassed':checks}
    output=ROOT/'artifacts/qa'; output.mkdir(parents=True,exist_ok=True)
    (output/'r2-source-truth.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['checksPassed','endpointQualifications']},indent=2))

if __name__=='__main__': main()
