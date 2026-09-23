"""Generate source-based inventory and candidate contours. Requires shapely==2.1.2.
Run: python -X utf8 scripts/semantic-map/generate.py
Candidate geometry supports drawing-based routes only after computational safety validation.
"""
from pathlib import Path
import json, hashlib
from shapely.geometry import Point, Polygon
from explore import ROOT, read, labels, polys, walls, seals, align
from drawing_graph import derive
from features import derive_features
OUT=ROOT/'data/buildings/B03'; OUT.mkdir(parents=True,exist_ok=True)
CONTENT=ROOT/'content/B03'; CONTENT.mkdir(parents=True,exist_ok=True)
AVAILABILITY_CONFIG = ROOT/'scripts/semantic-map/availability.json'
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read_availability():
    """Read operational room availability overrides from a deterministic input.

    The file is intentionally separate from generated floor JSON so operators can
    toggle destinations without altering source geometry, evidence, or access data.
    Omitted rooms retain the legacy available default (no availability field).
    """
    if not AVAILABILITY_CONFIG.exists():
        return {}
    raw=json.loads(AVAILABILITY_CONFIG.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ValueError('availability configuration must be an object keyed by room code')
    for code,value in raw.items():
        if not isinstance(code,str) or not isinstance(value,dict):
            raise ValueError('availability entries must map room codes to objects')
        if value.get('status') not in ('available','unavailable'):
            raise ValueError(f'{code}: availability status must be available or unavailable')
        reason=value.get('reason')
        if not isinstance(reason,dict) or not isinstance(reason.get('en'),str) or not reason['en'].strip() or not isinstance(reason.get('ar'),str) or not reason['ar'].strip():
            raise ValueError(f'{code}: availability reason requires non-empty en and ar')
    return raw
availability_overrides=read_availability()
schedule=read('maps/B03/GF/source/room-schedule.json')['rows']
arabic=['المدخل الرئيسي','الممر ١','الممر ٢','الممر ٣','قاعة المحاضرات','مخزن','صالة كبار الزوار','السلم ٣','ردهة المصاعد','غرفة الصمامات','مخزن','دورات مياه النساء','دورات مياه الرجال','ردهة','غرفة الترجمة','غرفة الوسائط السمعية والبصرية','السلم ٤','الكافتيريا','خدمة','المطبخ','مخزن','غرفة الأمن','السلم ٢','قاعة المعارض','مكتب العمليات','فتحة إضاءة علوية','الاستقبال','العيادة','الاستراحة','غرفة الاجتماعات','ردهة','السلم ١','غرفة الصلاة','مخزن','غرفة النسخ','غرفة الأرشيف','مجرى النفايات','غرفة التحكم','الخدمات','مخزن','دورة مياه النساء','دورة مياه الرجال','المعمل الميكانيكي','غرفة التحكم السمعي والبصري','معمل التدريب البدني ١','معمل التدريب البدني ٢','استوديو الوسائط السمعية والبصرية','غرفة الخدمات','خزانة التكييف والتهوية','معمل التدريب البصري ١','غرفة تقنية المعلومات','غرفة الكهرباء','ردهة المصاعد','السلم ٥']
conflicts={8:'Plan STAIR (03) is tagged 007, but the schedule assigns G-08; association by unique stair name is candidate.',17:'Plan STAIR (04) is tagged 009, but the schedule assigns G-17; association by unique stair name is candidate.',24:'Plan EXHIPITION ROOM is tagged 045, but the schedule assigns G-24. It is NOT Physical Training Lab G-45; association by unique use is candidate.',25:'Plan G25 is STAFF; schedule G-25 is OPERATIONS OFFICE. Schedule retained; use conflict unresolved.',34:'Plan G34 is PANTRY; schedule G-34 is STORAGE. Schedule retained; use conflict unresolved.'}
def label_code(l):
 return {'007':8,'009':17,'045':24}.get(l['code'],int(l['code']))
for l in labels:l['scheduleNumber']=label_code(l)
def category(n):
 if n in [1,2,3,4,8,9,14,17,23,31,32,53,54]:return 'circulation'
 if n in [12,13,41,42]:return 'restroom'
 if n in [43,45,46,47,50]:return 'laboratory'
 if n in [15,22,25,30,38,44]:return 'office'
 if n in [6,10,11,19,20,21,34,35,36,37,39,40,48,49,51,52]:return 'service'
 return 'other'
rooms=[]; contents=[]; review=[]
for n,row in enumerate(schedule,1):
 choices=[l for l in labels if l['scheduleNumber']==n]
 assert choices, f'Missing plan label for {row["code"]}'
 label=choices[0]; point=label['point']; inside=[p for p in polys if p.contains(Point(point))]
 polygon=None; reason='No closed source-vector face contains the plan label.'; contour=None
 if len(inside)==1:
  contour=inside[0]
  occupants=sorted(set(l['scheduleNumber'] for l in labels if contour.contains(Point(l['point']))))
  if contour.area>600000:reason='Label lies in an unbounded exterior/circulation-connected face; missing closures. No polygon accepted.'
  elif occupants!=[n]:reason=f'Face contains distinct room labels {occupants}; partition unresolved. No polygon accepted.'
  elif n==32:reason='Visual overlay shows this face leaking along a thin boundary connection into adjacent elevator enclosure; rejected pending wall-jamb repair evidence.'
  else:
   # Boundary tracks original vector free-space face; simplify below source stroke width.
   simple=contour.simplify(.18,preserve_topology=True)
   polygon=[[round(x,3),round(y,3)] for x,y in simple.exterior.coords[:-1]]
   reason=f'Source wall/glazing/door linework face; 0.20 drawing-unit line buffer and 0.18 simplification tolerance. {len(contour.interiors)} interior obstruction rings omitted from outer footprint; not navigable area. Swing/leaf gap closures are candidate evidence.'
 provenance=[dict(source='maps/B03/GF/source/0002.json#'+row['nameTextId'],page=1,note='Authoritative G-01…G-54 room schedule; name retained despite conflicting plan uses.',status='confirmed'),dict(source='maps/B03/GF/source/'+label['sourceId']+'.json#'+label['id'],page=1,note='Plan label '+label['name']+'; tag '+label['code']+'. Centroid field is the source name-label bounding-box center, not a computed room centroid. '+conflicts.get(n,''),status='candidate' if n in conflicts else 'confirmed'),dict(source='scripts/semantic-map/generate.py',page=1,note='Arabic name is an editorial translation of the English schedule, pending facility terminology review. Public=true means directory-visible only; no physical access is asserted.',status='candidate'),dict(source='scripts/semantic-map/explore.py',page=1,note=reason,status='candidate' if polygon else 'unknown')]
 code=row['code']; rid='B03-GF-'+code
 room=dict(id=rid,code=code,buildingId='B03',floorId='GF',name=dict(en=' '.join(row['name'].split()).title(),ar=arabic[n-1]),category=category(n),polygon=polygon,geometryRef=('semantic:'+rid if polygon else None),centroid=[round(v,3) for v in point],doorNodeId=None,aliases=sorted(set([row['name'],label['name'],code.replace('-',''),label['code'],'G '+label['code']])),contentRef=rid,public=True,geometryStatus='candidate' if polygon else 'unknown',provenance=provenance)
 if code in availability_overrides:
  room['availability']=availability_overrides[code]
 rooms.append(room)
 contents.append(dict(id=rid,description=dict(en='Verified room information has not been supplied. This is a placeholder; confirm the room use and access with academy staff.',ar='لم تُقدَّم معلومات موثقة عن هذا المكان. هذا نص مؤقت؛ يُرجى تأكيد استخدام المكان وإمكانية الدخول إليه مع موظفي الأكاديمية.'),placeholder=True,image=None,imageAlt=dict(en='No verified room photograph available',ar='لا تتوفر صورة موثقة للمكان')))
 review.append(dict(code=code,sourceLabelIds=[l['id'] for l in choices],labelPosition=rooms[-1]['centroid'],geometryStatus=rooms[-1]['geometryStatus'],area=round(contour.area,3) if polygon else None,conflict=conflicts.get(n),reason=reason,doorCandidates=[s['id'] for s in seals if polygon and contour.boundary.distance(s['line'])<1]))
for i,a in enumerate(rooms):
 if a['polygon']:
  assert Polygon(a['polygon']).is_valid and Polygon(a['polygon']).covers(Point(a['centroid']))
  for b in rooms[i+1:]:
   if b['polygon']:assert Polygon(a['polygon']).intersection(Polygon(b['polygon'])).area<1, (a['code'],b['code'])
floor=dict(schemaVersion=1,building=dict(id='B03',name=dict(en='Building B03',ar='المبنى B03'),floorIds=['GF']),floor=dict(id='GF',buildingId='B03',name=dict(en='Ground Floor',ar='الدور الأرضي'),level=0,viewBox=align['viewBox'],mapAsset='/maps/B03/GF/master.svg',metersPerUnit=None,calibrationStatus='unknown'),rooms=rooms,kiosks=[dict(id='B03-GF-kiosk',buildingId='B03',floorId='GF',name=dict(en='Ground Floor Kiosk',ar='كشك الدور الأرضي'),nodeId=None,status='unknown')])
# Original source structural boundaries remain mandatory navigation constraints.
segments=[]
for line in walls:
 coords=list(line.coords)
 for a,b in zip(coords,coords[1:]):segments.append([[round(v,3) for v in a],[round(v,3) for v in b]])
segments=sorted({json.dumps(s):s for s in segments}.values())
nodes,edges,graph_evidence,nav_areas,missing_routes,topology_review=derive(rooms,walls,seals)
floor['mapFeatures']=derive_features(read)
write(OUT/'GF.shortest-paths.review.json',topology_review)
floor["navigationDefaults"]={"startRoomId":"B03-GF-G-01"}
graph=dict(nodes=nodes,edges=edges,metersPerUnit=None,calibrationStatus='unknown',navigableAreas=nav_areas,walls=segments,status='candidate' if edges else 'unknown',routingPolicy='drawing-based')
write(OUT/'GF.json',floor);write(OUT/'GF.graph.json',graph);write(CONTENT/'GF.json',contents)
write(OUT/'GF.review.json',dict(schemaVersion=1,method='Source-vector free-space polygonization with source swing-and-leaf gap evidence',bufferTolerance=.20,simplificationTolerance=.18,inventoryCount=len(rooms),candidatePolygonCount=sum(bool(r['polygon']) for r in rooms),confirmedPolygonCount=0,rooms=review,doorGapCandidates=[dict(arcPathId=s['id'],leafPathId=s['leaf'],segment=[[round(v,3) for v in p] for p in s['line'].coords],status='candidate') for s in seals],graphReview=dict(status=graph['status'],candidateConnections=graph_evidence,missingRouteRooms=missing_routes,reason='Drawing-based source doorway approaches within source-wall-constrained circulation regions. Candidate access and accessibility remain unknown. Shared-suite and exterior-only destinations carry explicit approach limitations. No physical kiosk is asserted.')))
print('GENERATED',len(rooms),'rooms,',len(nodes),'drawing-based nodes,',len(edges),'edges; missing',missing_routes)

