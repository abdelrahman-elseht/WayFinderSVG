"""Verify inventory, geometry safety, evidence links, and optional byte determinism."""
from pathlib import Path
import json, hashlib, subprocess, sys
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[2]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
paths=['data/buildings/B03/GF.json','data/buildings/B03/GF.graph.json','data/buildings/B03/GF.review.json','content/B03/GF.json']
if '--regenerate' in sys.argv:
 before={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
 subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/semantic-map/generate.py')],check=True)
 assert before=={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths},'Regeneration changed output bytes'
d,g,review,c=map(read,paths)
schedule=read('maps/B03/GF/source/room-schedule.json')['rows']
assert len(d['rooms'])==54 and {r['code'] for r in d['rooms']}=={r['code'] for r in schedule}
assert len({r['id'] for r in d['rooms']})==54
assert {r['contentRef'] for r in d['rooms']}=={r['id'] for r in c}
assert all(r['placeholder'] and r['image'] is None and all(r['description'].values()) for r in c)
assert d['floor']['metersPerUnit'] is None and all(k['nodeId'] is None and k['status']=='unknown' for k in d['kiosks'])
assert g['navigableAreas'] and g['status']=='candidate' and g['routingPolicy']=='drawing-based'
assert all(e['status']=='candidate' and e['restriction']=='unknown' and e['accessibility']=='unknown' for e in g['edges'])
wall=unary_union([LineString(s) for s in g['walls']])
for edge in g['edges']:
 line=LineString(edge['geometry']);assert not line.crosses(wall) and line.intersection(wall).length<.01
 assert abs(line.length-edge['distance'])<.01
 assert edge['geometry'][0]==next(n['point'] for n in g['nodes'] if n['id']==edge['from'])
 assert edge['geometry'][-1]==next(n['point'] for n in g['nodes'] if n['id']==edge['to'])
assert all(r['doorNodeId'] for r in d['rooms'])
subprocess.run([sys.executable,str(ROOT/'scripts/semantic-map/verify_navigation.py')],cwd=ROOT,check=True)
polygons=[]
for room in d['rooms']:
 assert (room['doorNodeId'] is None or room['doorNodeId'] in [n['id'] for n in g['nodes'] if n['status']=='candidate']) and room['public'] and all(room['name'].values())
 x,y=room['centroid'];assert 650<=x<=3750 and 500<=y<=2050
 assert room['geometryStatus']==('candidate' if room['polygon'] else 'unknown')
 if room['polygon']:
  p=Polygon(room['polygon']);assert p.is_valid and p.area>50 and p.covers(Point(room['centroid']))
  for other,op in polygons:assert p.intersection(op).area<1,(room['code'],other)
  polygons.append((room['code'],p))
for source in ['0001','0002']:
 raw=read('maps/B03/GF/source/'+source+'.json'); ids={p['id'] for p in raw['paths']}
 for seal in review['doorGapCandidates']:
  if seal['arcPathId'].startswith(source):assert seal['arcPathId'] in ids and seal['leafPathId'] in ids
print(json.dumps(dict(inventory=54,uniqueIds=54,validCandidatePolygons=len(polygons),unresolvedPolygons=54-len(polygons),labelContainment='passed',unrelatedOverlap='passed',doorEvidenceReferences='passed',unknownAccessSafety='passed',determinism='passed' if '--regenerate' in sys.argv else 'not requested')))
