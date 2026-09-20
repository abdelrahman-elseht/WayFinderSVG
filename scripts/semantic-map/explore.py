from pathlib import Path
import json, math, collections
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree
from shapely import set_precision
ROOT=Path(__file__).resolve().parents[2]
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
align=read('maps/B03/GF/alignment.json')
paths=[]; labels=[]
for source in align['sources']:
 d=read('maps/B03/GF/source/'+source['id']+'.json'); dx,dy=source['displayToMaster'][4:]; crop=source['planCrop']
 for p in d['paths']:
  if not (crop[0]<=p['bbox'][0]<=crop[2] and crop[1]<=p['bbox'][1]<=crop[3]):continue
  p={**p,'sourceId':source['id'],'items':[{**it,'points':[[x+dx,y+dy] for x,y in it['points']]} for it in p['items']]}
  # Keep whole paths on their authoritative side; overlap duplicate lines are harmless after union.
  paths.append(p)
 for i,t in enumerate(d['texts']):
  if t['text']=='G' and i>=2:
   code,name=d['texts'][i-2:i]
   if not code['text'].isdigit():continue
   pt=[(name['bbox'][0]+name['bbox'][2])/2+dx,(name['bbox'][1]+name['bbox'][3])/2+dy]
   if not (650<pt[0]<3750 and 500<pt[1]<2050):continue
   labels.append(dict(code=code['text'],name=name['text'],id=name['id'],point=pt,sourceId=source['id']))
def sample(it):
 ps=it['points']
 if it['type']=='cubic':return [[sum([((1-t)**3),3*t*(1-t)**2,3*t*t*(1-t),t**3][i]*ps[i][j] for i in range(4)) for j in range(2)] for t in [i/24 for i in range(25)]]
 return ps+([ps[0]] if it['type'] in ['rect','quad'] else [])
walls=[]; doorlines=[]; arcs=[]
for p in paths:
 wall=p['layer'] in ['A-WALL','A-WALL-02','A-CONC','A-GYPSUM BOARD','A-CLADDING-STONE','A-GLAZING-6700','A-INT-GLAZ-01','02-XA-B03-GROUND FLOOR SKIN$0$A-WALL']
 door='DOOR' in p['layer'] and p['layer']!='A-DOOR-STEP'
 if not wall and not door:continue
 for it in p['items']:
  line=LineString(sample(it))
  if line.length<.001:continue
  if wall:walls.append(line)
  if door:
   if it['type']=='cubic':arcs.append((p,it))
   else:doorlines.append((p,line))
door_tree=STRtree([l for _,l in doorlines])
seals=[]
for p,it in arcs:
 ps=it['points']; a,b=ps[0],ps[-1]
 # Infer hinge by intersecting endpoint normals of cubic quarter-circle swing.
 va=[-(ps[1][1]-a[1]),ps[1][0]-a[0]]; vb=[-(b[1]-ps[2][1]),b[0]-ps[2][0]]
 det=va[0]*vb[1]-va[1]*vb[0]
 if abs(det)<.001:continue
 delta=[b[0]-a[0],b[1]-a[1]]; t=(delta[0]*vb[1]-delta[1]*vb[0])/det
 center=[a[0]+t*va[0],a[1]+t*va[1]]; radius=math.dist(center,a)
 if radius<10 or radius>65 or abs(math.dist(center,b)-radius)>2:continue
 matches=[]
 for index in door_tree.query(Point(center).buffer(3)):
  dp,l=doorlines[index]
  if dp['sourceId']!=p['sourceId']:continue
  if abs(l.length-radius)>2:continue
  ends=[list(l.coords[0]),list(l.coords[-1])]
  if min(math.dist(center,e) for e in ends)>2:continue
  for endpoint,closed in [(a,b),(b,a)]:
   if min(math.dist(endpoint,e) for e in ends)<2:matches.append((dp['id'],closed))
 if not matches:continue
 closed=matches[0][1]; v=[(closed[j]-center[j])/radius for j in range(2)]
 line=LineString([[center[j]-3*v[j] for j in range(2)],[closed[j]+3*v[j] for j in range(2)]])
 seals.append(dict(id=p['id'],sourceId=p['sourceId'],leaf=matches[0][0],line=line))
# Narrow buffer resolves sub-point PDF drafting gaps; resulting contours explicitly candidate.
network=unary_union([set_precision(l,.01) for l in walls+[l for _,l in doorlines]+[s['line'] for s in seals]])
solid=network.buffer(.20,join_style=2)
free=box(640,490,3760,2060).difference(solid)
polys=[p for p in free.geoms if p.area>50] if hasattr(free,'geoms') else [free]
if __name__=='__main__':
 print('walls',len(walls),'arcs',len(arcs),'seals',len(seals),'free polygons',len(polys))
 for l in labels:
  containing=[p for p in polys if p.contains(Point(l['point']))]
  print(l['code'],l['name'],l['sourceId'],[(round(p.area),len(p.exterior.coords),len(p.interiors)) for p in containing])
