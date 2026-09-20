"""Read-only original vector review; PNG crops are visual QA, never traced geometry."""
import json
from pathlib import Path
import pymupdf as fitz
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/qa'; OUT.mkdir(exist_ok=True,parents=True)
sources={k:json.loads((ROOT/f'maps/B03/GF/source/{k}.json').read_text(encoding='utf8')) for k in ['0001','0002']}
crops={'g06':(3250,880,3650,1200),'g06-wide':(3190,980,3590,1390),'g17':(2880,1490,3390,1870),'g23':(1930,1520,2480,1890),'front':(1800,1500,3400,1990),'lobby14-context':(2630,1280,3270,1640),'lobby14-bottom':(2800,1500,3060,1750)}
for name,b in crops.items():
 with fitz.open(ROOT/sources['0002']['file']) as doc:
  rect=fitz.Rect(b[0]-1033.29,b[1]+28.35,b[2]-1033.29,b[3]+28.35)
  doc[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=rect,alpha=False).save(OUT/f'r2-exterior-{name}.png')
with fitz.open(ROOT/sources['0001']['file']) as doc:
 doc[0].get_pixmap(matrix=fitz.Matrix(3,3),clip=fitz.Rect(1112.40564,1050.12732,1441.66907,1391.22998),alpha=False).save(OUT/'r2-exterior-av-control.png')
ids2=[7131,7132,7162,7163,7164,7133,7134,7144,7145,7146,7071,7072,7093,7930,7929,8027,8038,8275,6040,6039]+list(range(9911,9956))
ids1=[11645,11647,11655]
evidence={'coordinateSystem':'display-to-master translation; x right/y down; no second rotation','displayToMaster':{'0001':[1,0,0,1,0,0],'0002':[1,0,0,1,1033.29,-28.35]},'paths':[]}
for sid,ids in [('0001',ids1),('0002',ids2)]:
 for p in sources[sid]['paths']:
  if int(p['id'].rsplit('-',1)[1]) not in ids:continue
  q=json.loads(json.dumps(p)); dx,dy=(0,0) if sid=='0001' else (1033.29,-28.35)
  q['sourceId']=sid;q['masterItems']=[{'type':i['type'],'points':[[round(x+dx,5),round(y+dy,5)] for x,y in i['points']]} for i in p['items']]
  evidence['paths'].append(q)
evidence['siteLayerIntersections']={}
for name,b in crops.items():
 if name not in ['g06','g17','g23','front']:continue
 found=[]
 for p in sources['0002']['paths']:
  if 'SITE' not in p['layer']:continue
  a=p['bbox'];m=[a[0]+1033.29,a[1]-28.35,a[2]+1033.29,a[3]-28.35]
  if m[0]<b[2] and m[2]>b[0] and m[1]<b[3] and m[3]>b[1]:found.append(p['id'])
 evidence['siteLayerIntersections'][name]=found
(OUT/'r2-exterior-vector-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf8')
print('Wrote 8 original PDF crops and vector evidence; no production map changes.')
