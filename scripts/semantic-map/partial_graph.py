"""Conservative candidate corridor links from actual doors/opposing wall hits.
These are review candidates only: access and containment have not been approved.
"""
import math
from shapely.geometry import Point, LineString, Polygon
from shapely.ops import unary_union
def derive(rooms,walls,seals):
 wall=unary_union(walls); boundary=unary_union(walls+[s['line'] for s in seals]); nodes=[]; edges=[]; evidence=[]
 def rounded(p):return [round(v,3) for v in p]
 def edge(a,b,kind):
  line=LineString([a['point'],b['point']])
  # A source structural wall crossing disqualifies the connection entirely.
  if line.intersection(wall).length>.001 or line.crosses(wall):return False
  edges.append(dict(id=a['id']+'--'+b['id'],from_=a['id'],to=b['id'],floorId='GF',pathType=kind,distance=round(line.length,3),distanceUnit='map-unit',accessibility='unknown',restriction='unknown',status='candidate',bidirectional=True,geometry=[a['point'],b['point']]))
  edges[-1]['from']=edges[-1].pop('from_');return True
 for code in ['G-45','G-46']:
  room=next(r for r in rooms if r['code']==code)
  if not room['polygon']:continue
  poly=Polygon(room['polygon']); nearby=[s for s in seals if poly.boundary.distance(s['line'])<1]
  if len(nearby)!=2:continue
  portal=[sum(s['line'].interpolate(.5,normalized=True).coords[0][j] for s in nearby)/2 for j in range(2)]
  coords=list(nearby[0]['line'].coords); v=[coords[1][j]-coords[0][j] for j in range(2)]; length=math.hypot(*v); normal=[-v[1]/length,v[0]/length]
  if poly.contains(Point([portal[j]+normal[j]*10 for j in range(2)])):normal=[-v for v in normal]
  ray=LineString([[portal[j]+normal[j]*5 for j in range(2)],[portal[j]+normal[j]*250 for j in range(2)]])
  hits=ray.intersection(boundary)
  def points(g):
   if g.is_empty:return []
   if g.geom_type=='Point':return [g]
   if hasattr(g,'geoms'):return [p for part in g.geoms for p in points(part)]
   return [Point(c) for c in g.coords]
  hits=points(hits)
  if not hits:continue
  hit=min(hits,key=lambda p:p.distance(Point(portal))); width=hit.distance(Point(portal))
  if not 30<width<180:continue
  center=[(portal[j]+list(hit.coords)[0][j])/2 for j in range(2)]
  door=dict(id=room['id']+'-door-candidate',buildingId='B03',floorId='GF',point=rounded(portal),type='door',roomId=room['id'],status='candidate')
  junction=dict(id=room['id']+'-corridor-candidate',buildingId='B03',floorId='GF',point=rounded(center),type='junction',status='candidate')
  if not edge(door,junction,'door'):continue
  nodes.extend([door,junction]); room['doorNodeId']=door['id']
  hit_seals=[s['id'] for s in seals if s['line'].distance(hit)<.01]
  evidence.append(dict(roomId=room['id'],sourceArcIds=[s['id'] for s in nearby],portal=rounded(portal),opposingBoundaryHit=rounded(list(hit.coords)[0]),opposingBoundaryType='source-door-gap-candidate' if hit_seals else 'source-wall',opposingDoorArcIds=hit_seals,crossSectionWidth=round(width,3),note='Portal derives from the two source-evidenced swing closures; junction is halfway to first opposing wall or source-evidenced door-gap boundary intersection along the outward door normal. Units uncalibrated. Candidate only: corridor-area topology and permitted access remain unverified.'))
 if len(nodes)==4:edge(nodes[1],nodes[3],'corridor')
 return nodes,edges,evidence
