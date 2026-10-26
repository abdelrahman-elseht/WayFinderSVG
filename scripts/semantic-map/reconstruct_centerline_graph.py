"""Independent GF graph reconstruction from corridor spines and validated areas."""
import json
import heapq
import math
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import linemerge, unary_union
from shapely.strtree import STRtree
from shapely import prepare

ROOT = Path(__file__).resolve().parents[2]
cfg = json.loads((ROOT/'scripts/semantic-map/navigation-config.json').read_text(encoding='utf-8'))
floor = json.loads((ROOT/'data/buildings/B03/GF.json').read_text(encoding='utf-8'))
legacy = json.loads((ROOT/'data/buildings/B03/GF.graph.json').read_text(encoding='utf-8'))
domain = unary_union([Polygon(p) for p in legacy['navigableAreas']])
walls = [LineString(w) for w in legacy['walls']]
wall_tree = STRtree(walls)
def safe(line):
    # Do not inflate the walkable domain to make near-misses look connected.
    # Candidate joins must be wholly covered by the validated source geometry.
    return domain.covers(line) and not any(line.intersects(walls[i]) for i in wall_tree.query(line))
def local_astar(start,end,step=8,padding=100):
    minx,miny=max(domain.bounds[0],min(start[0],end[0])-padding),max(domain.bounds[1],min(start[1],end[1])-padding)
    maxx,maxy=min(domain.bounds[2],max(start[0],end[0])+padding),min(domain.bounds[3],max(start[1],end[1])+padding)
    local=domain.intersection(box(minx,miny,maxx,maxy))
    local=local.buffer(-.02)
    if local.is_empty:return None
    prepare(local)
    nx=math.ceil((maxx-minx)/step)+1;ny=math.ceil((maxy-miny)/step)+1
    def xy(k):return (minx+k[0]*step,miny+k[1]*step)
    def snap(p):
        ix=round((p[0]-minx)/step);iy=round((p[1]-miny)/step);opts=[]
        for radius in range(10):
            for dy in range(-radius,radius+1):
                for dx in range(-radius,radius+1):
                    x,y=ix+dx,iy+dy
                    if max(abs(dx),abs(dy))!=radius or x<0 or y<0 or x>=nx or y>=ny:continue
                    q=xy((x,y));line=LineString([p,q])
                    if local.covers(Point(q)) and local.covers(line):opts.append((line.length,x,y))
            if opts:break
        return (min(opts)[1],min(opts)[2]) if opts else None
    source,target=snap(start),snap(end)
    if source is None or target is None:return None
    best={source:0.};prev={};queue=[(0.,0.,source)]
    moves=[(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]
    while queue and len(best)<=nx*ny:
        _,cost,current=heapq.heappop(queue)
        if cost!=best[current]:continue
        if current==target:break
        for dx,dy in moves:
            nxt=(current[0]+dx,current[1]+dy)
            if not(0<=nxt[0]<nx and 0<=nxt[1]<ny):continue
            line=LineString([xy(current),xy(nxt)])
            if not local.covers(line):continue
            value=cost+line.length
            if value>=best.get(nxt,float('inf')):continue
            best[nxt]=value;prev[nxt]=current
            heapq.heappush(queue,(value+math.dist(xy(nxt),xy(target)),value,nxt))
    if target not in best:return None
    path=[target]
    while path[-1]!=source:path.append(prev[path[-1]])
    coords=[start,*[xy(k) for k in reversed(path)],end]
    simple=[coords[0]];i=0
    while i<len(coords)-1:
        j=len(coords)-1
        while j>i+1 and not local.covers(LineString([coords[i],coords[j]])):j-=1
        simple.append(coords[j]);i=j
    line=LineString(simple)
    return line if safe(line) else None
def parts(geom):
    if geom.geom_type == 'LineString': return [geom]
    return [line for part in getattr(geom, 'geoms', []) for line in parts(part)]

clipped=[]
for index, spine in enumerate(cfg['corridorSpines']):
    clipped.extend((index,line) for line in parts(LineString(spine).intersection(domain)) if line.length>.5)
network=unary_union([line for _,line in clipped])
component_lines=parts(network)
# Candidate connectors are evaluated between noded component endpoints. Keep
# all short safe alternatives, while using a Kruskal pass only to ensure each
# source component group becomes connected when geometry supports it.
endpoints=[]
for i,line in enumerate(component_lines):
    endpoints.extend([(i,tuple(line.coords[0])),(i,tuple(line.coords[-1]))])
endpoint_tree=STRtree([Point(p).buffer(cfg['corridorHalfWidth']*2) for _,p in endpoints])
candidates=[]
for i,(ci,a) in enumerate(endpoints):
    for j in endpoint_tree.query(Point(a).buffer(cfg['corridorHalfWidth']*2)):
        j=int(j)
        if j<=i: continue
        cj,b=endpoints[j]
        if ci==cj: continue
        line=LineString([a,b])
        if safe(line): candidates.append((line.length,ci,cj,a,b,line))
candidates.sort(key=lambda row:(round(row[0],6),row[1],row[2],row[3],row[4]))
parent=list(range(len(component_lines)))
def find(i):
    while parent[i]!=i: parent[i]=parent[parent[i]];i=parent[i]
    return i
bridges=[]
for candidate in candidates:
    _,a,b,*_=candidate;ra,rb=find(a),find(b)
    if ra!=rb: parent[ra]=rb;bridges.append(candidate)
    elif candidate[0] <= cfg['corridorHalfWidth']*.75: bridges.append(candidate)
skeleton=unary_union([network,*[row[-1] for row in bridges]])

# Use only the point of each existing legacy approach node as room endpoint
# evidence. No legacy edge or path geometry participates in reconstruction.
approaches={n['id']:n for n in legacy['nodes'] if n.get('roomId')}
if len(approaches)!=54: raise ValueError(f'Expected 54 room approach points, got {len(approaches)}')
room_links=[];unresolved=[]
for room in floor['rooms']:
    node=approaches.get(room.get('doorNodeId'))
    if not node: unresolved.append(dict(room=room['code'],reason='missing source approach node'));continue
    point=Point(node['point']);options=[]
    for line in parts(skeleton):
        snap=line.interpolate(line.project(point));connector=LineString([point,snap])
        if connector.length < .001:
            options.append((0.0,tuple(snap.coords)[0],connector));continue
        if connector.length <= cfg['corridorHalfWidth']*2 and safe(connector): options.append((connector.length,tuple(snap.coords)[0],connector))
    if not options:
        # Bounded local A* fallback is only attempted for source approach
        # joins; it never contributes grid vertices to the routing graph.
        nearby=sorted(parts(skeleton),key=lambda line:line.distance(point))[:4]
        for line in nearby:
            snap=line.interpolate(line.project(point))
            if point.distance(snap)>cfg['corridorHalfWidth']*2:continue
            path=local_astar(tuple(node['point']),tuple(snap.coords)[0])
            if path is not None:options.append((path.length,tuple(snap.coords)[0],path))
    if not options:
        unresolved.append(dict(room=room['code'],point=list(node['point']),reason='no direct or bounded local-A* connector covered by walkable areas and clear of walls'))
    else:
        length,snap,connector=min(options,key=lambda row:(round(row[0],6),row[1]))
        room_links.append((room,node,tuple(node['point']),snap,connector))
skeleton=unary_union([skeleton,*[row[-1] for row in room_links]])
noded=unary_union(skeleton)
merged=linemerge(noded)
lines=parts(merged)

# Degree-two coordinates remain polyline points; merged line endpoints encode
# the actual graph topology. Room approaches remain protected even if shared.
point_rooms={}
for room,node,p,snap,connector in room_links:
    point_rooms.setdefault(tuple(round(v,8) for v in p),[]).append((room,node))
coords=set()
for line in lines:
    coords.add(tuple(round(v,8) for v in line.coords[0]));coords.add(tuple(round(v,8) for v in line.coords[-1]))
for _,_,p,snap,_ in room_links: coords.add(tuple(round(v,8) for v in p));coords.add(tuple(round(v,8) for v in snap))
ids={};nodes=[]
for p in sorted(coords):
    associated=point_rooms.get(p,[])
    if associated:
        room,node=associated[0];nid=node['id']; room_ids=sorted({r['id'] for r,_ in associated})
        n=dict(id=nid,buildingId='B03',floorId='GF',point=list(p),type=node['type'],roomId=room['id'],status='candidate')
    else:
        nid=f'B03-GF-v2-j{len(ids):03}';n=dict(id=nid,buildingId='B03',floorId='GF',point=list(p),type='junction',status='candidate')
    ids[p]=nid;nodes.append(n)
edges=[];seen=set()
rejected_edges=[]
adjacency={n['id']:set() for n in nodes}
def append_edge(a,b,points,kind):
    if a==b:return
    geometry=[[round(float(x),8),round(float(y),8)] for x,y in points]
    line=LineString(geometry)
    if not safe(line):
        rejected_edges.append(dict(fromNode=a,toNode=b,kind=kind,reason='serialized polyline is not covered by exact walkable union or contacts a wall'))
        return
    key=tuple(sorted((a,b)))
    if key in seen:return
    seen.add(key);edges.append(dict(id=f'B03-GF-v2-e{len(edges):03}',**{'from':a,'to':b},floorId='GF',pathType=kind,
        distance=round(line.length,8),distanceUnit='map-unit',accessibility='unknown',restriction='unknown',status='candidate',bidirectional=True,geometry=geometry))
    adjacency[a].add(b);adjacency[b].add(a)
for line in lines:
    points=[[round(float(x),4),round(float(y),4)] for x,y in line.coords]
    a,b=tuple(points[0]),tuple(points[-1])
    if a in ids and b in ids and a!=b:append_edge(ids[a],ids[b],points,'corridor')
for room,node,p,snap,connector in room_links:
    a=tuple(round(v,8) for v in p);b=tuple(round(v,8) for v in snap)
    if a not in ids or b not in ids: unresolved.append(dict(room=room['code'],reason='approach lost during line noding'))
    else:append_edge(ids[a],ids[b],list(connector.coords),'door')
v2={'nodes':nodes,'edges':edges,'navigableAreas':legacy['navigableAreas'],'walls':legacy['walls'],
    'metersPerUnit':None,'calibrationStatus':'unknown','status':'candidate','routingPolicy':'drawing-based'}
Path('artifacts/navigation-v2/GF.v2.graph.diagnostic.json').write_text(json.dumps(v2,indent=2)+'\n',encoding='utf-8')
unvisited=set(adjacency);network_components=[]
while unvisited:
    start=min(unvisited);stack=[start];component=set()
    while stack:
        current=stack.pop()
        if current in component:continue
        component.add(current);stack.extend(adjacency[current]-component)
    unvisited-=component;network_components.append(component)
attached_node_ids={room['doorNodeId'] for room in floor['rooms'] if room.get('doorNodeId') in {n['id'] for n in nodes}}
report={'sourceComponentsRaw':31,'clippedSpineComponents':len(component_lines),'safeCandidateConnections':len(candidates),
    'selectedConnections':len(bridges),'roomApproachesConnected':len(attached_node_ids),'nodes':len(nodes),'edges':len(edges),
    'resultingGraphComponents':len(network_components),'componentSizes':sorted((len(c) for c in network_components),reverse=True),
    'rejectedSerializedEdges':rejected_edges,'unresolved':unresolved,'generation':'independent; legacy data contributes only existing endpoint coordinates and validated area/wall constraints',
    'runtimePromotion':'blocked while unresolved approaches remain'}
(ROOT/'artifacts/navigation-v2/reconstruction-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
