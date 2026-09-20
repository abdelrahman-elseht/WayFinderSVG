"""Deterministic drawing-based paths confined to reviewed circulation regions.
Doors are source swing/leaf evidence. The route endpoint remains on its approach side.
"""
import json, math, heapq
from collections import defaultdict
from shapely.geometry import Point, LineString, Polygon, box
from shapely.ops import unary_union
from shapely import set_precision, contains_xy, constrained_delaunay_triangles, prepare
import numpy as np
from explore import ROOT

def derive(rooms,walls,seals):
 cfg=json.loads((ROOT/'scripts/semantic-map/navigation-config.json').read_text(encoding='utf8'))
 wall=unary_union([set_precision(w,.01) for w in walls])
 regions=unary_union([LineString(p).buffer(cfg['corridorHalfWidth'],cap_style=2,join_style=2) for p in cfg['corridorSpines']])
 blocked=[Polygon(r['polygon']).buffer(.3) for r in rooms if r['polygon']]
 # AV suite is a source face with two labels: it is not common circulation.
 from explore import polys
 av=next(p for p in polys if p.contains(Point(next(r['centroid'] for r in rooms if r['code']=='G-47'))))
 foyer=Polygon([[1225,1100],[1325,1075],[1360,1170],[1250,1200]])
 blocked.append(av.difference(foyer))
 # Conservatively keep the open skylight footprint out of walking geometry.
 blocked.append(Polygon([[1488,1280],[1810,1205],[1865,1432],[1550,1460]]))
 blocked.append(Polygon([[2140,960],[2240,960],[2240,1440],[2140,1440]]))
 domain=regions.difference(unary_union(blocked)).difference(wall.buffer(.8,join_style=2))
 # Remove sub-stroke PDF overlap noise before planar decomposition. This precision
 # is 1/80 of the reserved wall clearance and never changes architectural gaps.
 domain=set_precision(domain,.01).simplify(.01,preserve_topology=True)
 prepare(domain)
 # Keep exact original structural linework in final evidence, not snapped surrogates.
 minx,miny,maxx,maxy=domain.bounds;step=3.;ox=math.floor(minx/step)*step;oy=math.floor(miny/step)*step
 nx=int((maxx-ox)/step)+2;ny=int((maxy-oy)/step)+2
 xx,yy=np.meshgrid(np.arange(nx)*step+ox,np.arange(ny)*step+oy)
 mask=contains_xy(domain,xx,yy)
 def pos(k):return (ox+(k%nx)*step,oy+(k//nx)*step)
 def nearest(p):
  ix=round((p[0]-ox)/step);iy=round((p[1]-oy)/step)
  result=[]
  for dy in range(-10,11):
   for dx in range(-10,11):
    x,y=ix+dx,iy+dy
    if 0<=x<nx and 0<=y<ny and mask[y,x]:
     k=y*nx+x;line=LineString([p,pos(k)])
     if domain.covers(line):result.append((line.length,k))
  return min(result)[1] if result else None
 rootroom=rooms[0];root=nearest(rootroom['centroid']);assert root is not None
 distance={root:0};parent={root:None};queue=[(0,root)]
 while queue:
  dist,k=heapq.heappop(queue)
  if dist!=distance[k]:continue
  x,y=k%nx,k//nx
  for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
   a,b=x+dx,y+dy
   if not (0<=a<nx and 0<=b<ny and mask[b,a]):continue
   nk=b*nx+a;nd=dist+step*math.hypot(dx,dy)
   if nd>=distance.get(nk,float('inf')):continue
   if not domain.covers(LineString([pos(k),pos(nk)])):continue
   distance[nk]=nd;parent[nk]=k;heapq.heappush(queue,(nd,nk))
 endpoints=[];evidence=[];fail=[]
 for r in rooms:
  spec=cfg['roomEndpoints'][r['code']];candidates=[];s=None
  if spec.get('arcPathId'):
   s=next(s for s in seals if s['id']==spec['arcPathId'])
   if spec.get('sourceDoorSegment'):s={**s,'line':LineString(spec['sourceDoorSegment'])}
   p=s['line'].interpolate(.5,normalized=True);p=[p.x,p.y]
   a,b=s['line'].coords;ln=math.dist(a,b);normal=[-(b[1]-a[1])/ln,(b[0]-a[0])/ln]
   for v in [2,4,6,10,15,22,30]:
    for sign in [1,-1]:candidates.append([p[j]+normal[j]*v*sign for j in range(2)])
  else:candidates=[spec.get('point',r['centroid'])]
  opts=[]
  for p in candidates:
   if not domain.covers(Point(p)):continue
   k=nearest(p)
   if k is not None and k in distance:opts.append((math.dist(p,list(s['line'].interpolate(.5,normalized=True).coords)[0]) if s else 0,distance[k],p,k))
  if not opts:
   fail.append(r['code'])
   print('MISSING',r['code'],[(tuple(round(v,1) for v in p),domain.covers(Point(p)),nearest(p) in distance if domain.covers(Point(p)) else False) for p in candidates],flush=True)
   continue
  _,_,p,k=min(opts)
  if spec.get('note'):r['navigationNote']=spec['note']
  if spec.get('partial'):r['navigationPartial']=True
  r['provenance'].append(dict(source='scripts/semantic-map/navigation-config.json#roomEndpoints/'+r['code'],page=1,status='candidate',note='Drawing-based endpoint '+spec.get('kind','source doorway approach' if s else 'open circulation approach')+'. '+spec.get('note',{}).get('en','Door approach derived from source swing and leaf geometry; access and accessibility unknown.')))
  r['doorNodeId']=r['id']+'-approach'
  endpoints.append((r,p,k))
  evidence.append(dict(roomId=r['id'],kind=spec.get('kind','source-door-approach' if s else 'open-circulation-approach'),point=p,source=spec,sourceDoorSegment=list(s['line'].coords) if s else None))
 print('routing endpoints',len(endpoints),'missing',fail,flush=True)
 # Union all shortest paths, then compress degree-two grid vertices.
 used=defaultdict(set)
 for _,_,k in endpoints:
  while parent[k] is not None:
   pk=parent[k];used[k].add(pk);used[pk].add(k);k=pk
 special={root}|{k for _,_,k in endpoints}|{k for k,v in used.items() if len(v)!=2}
 nodes=[];edges=[]
 def rnd(p):return [round(v,4) for v in p]
 for k in sorted(special):nodes.append(dict(id=f'B03-GF-j{k}',buildingId='B03',floorId='GF',point=rnd(pos(k)),type='junction',status='candidate'))
 def addedge(a,b,points,kind='corridor'):
  # Line-of-sight simplification within the same valid source-constrained region.
  simple=[points[0]];i=0
  while i<len(points)-1:
   j=len(points)-1
   while j>i+1 and not domain.covers(LineString([points[i],points[j]])):j-=1
   simple.append(points[j]);i=j
  simple=[rnd(p) for p in simple];length=LineString(simple).length
  if length<.001:return
  assert domain.buffer(.001).covers(LineString(simple))
  edges.append(dict(id=f'B03-GF-e{len(edges):03}',**{'from':a,'to':b},floorId='GF',pathType=kind,distance=round(length,4),distanceUnit='map-unit',accessibility='unknown',restriction='unknown',status='candidate',bidirectional=True,geometry=simple))
 seen=set()
 for start in sorted(special):
  for nxt in sorted(used[start]):
   if (start,nxt) in seen:continue
   chain=[start,nxt];seen.add((start,nxt));seen.add((nxt,start))
   while chain[-1] not in special:
    a,b=chain[-2:];n=next(k for k in used[b] if k!=a);chain.append(n);seen.add((b,n));seen.add((n,b))
   addedge(f'B03-GF-j{start}',f'B03-GF-j{chain[-1]}',[pos(k) for k in chain])
 for r,p,k in endpoints:
  nodes.append(dict(id=r['doorNodeId'],buildingId='B03',floorId='GF',point=rnd(p),type='entrance' if r['code']=='G-01' else 'door' if cfg['roomEndpoints'][r['code']].get('arcPathId') else 'junction',roomId=r['id'],status='candidate'))
  if math.dist(p,pos(k))<.001:
   # Keep distinct room endpoints with a short valid link to an adjacent grid node.
   k=next(iter(used[k]));
   if k not in special:
    nodes.append(dict(id=f'B03-GF-j{k}',buildingId='B03',floorId='GF',point=rnd(pos(k)),type='junction',status='candidate'))
  addedge(r['doorNodeId'],f'B03-GF-j{k}',[p,pos(k)],'door' if cfg['roomEndpoints'][r['code']].get('arcPathId') else 'corridor')
 # Polygons with holes are decomposed, preserving all wall/room/void exclusions.
 areas=[]
 def pieces(g):
  if g.geom_type=='Polygon':return [g]
  return [p for part in getattr(g,'geoms',[]) for p in pieces(part)]
 for x in range(math.floor(minx/25)*25,math.ceil(maxx/25)*25,25):
  for part in pieces(domain.intersection(box(x,miny-1,x+25,maxy+1))):
   candidates=list(constrained_delaunay_triangles(part).geoms) if part.interiors else [part]
   for area in candidates:
    area=area.simplify(.005,preserve_topology=True)
    points=[rnd(p) for p in list(area.exterior.coords)[:-1]]
    points=[p for i,p in enumerate(points) if i==0 or p!=points[i-1]]
    if len({tuple(p) for p in points})>=3 and Polygon(points).area>.00001 and Polygon(points).is_valid:areas.append(points)
 return nodes,edges,evidence,areas,fail
