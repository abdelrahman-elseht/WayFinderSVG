import json,math
from pathlib import Path
from shapely.geometry import LineString,Polygon,Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
p=Path('data/buildings/B03');g=json.loads((p/'GF.graph.json').read_text());f=json.loads((p/'GF.json').read_text(encoding='utf8'))
cfg=json.loads(Path('scripts/semantic-map/navigation-config.json').read_text(encoding='utf8'))
foyer=Polygon(cfg['sharedAVFoyer']['polygon'])
obstacles=[(r['code'],Polygon(r['polygon']).buffer(-.01).difference(foyer) if r['code']==cfg['sharedAVFoyer']['roomCode'] else Polygon(r['polygon']).buffer(-.01)) for r in f['rooms'] if r['polygon']]
walllines=[LineString(w) for w in g['walls']];tree=STRtree(walllines)
areas=unary_union([Polygon(a) for a in g['navigableAreas']]);badwalls=[];badareas=[];badrooms=[]
for e in g['edges']:
 line=LineString(e['geometry'])
 for i in tree.query(line):
  if line.intersects(walllines[i]):badwalls.append((e['id'],int(i)))
 if not areas.buffer(.0002).covers(line):badareas.append(e['id'])
 for code,obstacle in obstacles:
  if line.intersection(obstacle).length>.01:badrooms.append((e['id'],code))
adj={n['id']:set() for n in g['nodes']}
for e in g['edges']:adj[e['from']].add(e['to']);adj[e['to']].add(e['from'])
seen=set();stack=[f['rooms'][0]['doorNodeId']]
while stack:
 n=stack.pop()
 if n in seen:continue
 seen.add(n);stack.extend(adj[n]-seen)
report=dict(nodes=len(g['nodes']),edges=len(g['edges']),navAreas=len(g['navigableAreas']),walls=len(g['walls']),graphBytes=(p/'GF.graph.json').stat().st_size,roomApproaches=len([r for r in f['rooms'] if r['doorNodeId'] in seen]),orderedRoomPairs=54*53 if len(seen)==len(adj) else None,wallContacts=badwalls,areaFailures=badareas,roomInteriorCrossings=badrooms)
print(json.dumps(report,indent=2));(p/'GF.navigation-validation.review.json').write_text(json.dumps(report,indent=2)+'\n')
assert not badwalls and not badareas and not badrooms and report['roomApproaches']==54
