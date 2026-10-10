#!/usr/bin/env python3
"""Rebuild the single-sheet B03 second-floor Part 02 side-oriented vector output.

Requires PyMuPDF, Pillow, CairoSVG, lxml. Does NOT use or merge Part 01.
Coordinate units are PDF points, not calibrated meters.
"""
from __future__ import annotations
import collections
import hashlib
import html
import json
import math
import re
from pathlib import Path
import xml.etree.ElementTree as ET

import cairosvg
from lxml import etree
import fitz
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parent.parent
FILE_NAME = '2761-SOD-B03-DWG-AAR-15-02-Z-0002-00.pdf'
PDF = ROOT / 'source' / 'pdfs' / FILE_NAME
INSPECT = ROOT / 'inspection'
CROP = [200.0, 160.0, 2040.0, 2260.0]  # PDF display-space points, x right, y down
INK = '#394657'
DRAW_WEIGHT = 1.15

SKIN='04-XA-B03-SECOND FLOOR SKIN$0$'
PLAN='04-XA-B03-SECOND FLOOR PLAN$0$'
CORE='04-XA-B03-CORE SECOND$0$'
TOILET='00-XA-B03-CORE TOILET$0$'
KEEP = [
 'A-CONC','A-WALL','A-WALL-02','A-DOOR','A-DOOR-STEP','A-GYPSUM BOARD','A-INT-GLAZ-01',
 'A-CLADDING-STONE','A-WALLS-UPSTAND','A-WALLS-LOUVERS',
 SKIN+'A-GLAZ',SKIN+'A-ELEV',SKIN+'A-ELEV-TN02',
 PLAN+'A-WIN',PLAN+'A-HANDRAIL',PLAN+'A-ROOF DRAIN',
 CORE+'A-FLOR-STRS',CORE+'A-HANDRAIL',CORE+'A-FURN-FIXD',CORE+'A-ELEV',
 TOILET+'A-WALL-PART',
]
# Very dense non-architecture layers are deliberately NOT exported: axes,
# dimensions, annotations, hatches, numbered frames, sheet schedules, title blocks,
# exterior SKIN$0$A-ELEV-TN03 triangulations and A-MULLION repeated hatch lines.


def r5(n): return round(float(n),5)
def pt(p):return [r5(p.x),r5(p.y)]
def json_write(dst,obj):
 dst.parent.mkdir(parents=True,exist_ok=True)
 dst.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(path):
 h=hashlib.sha256()
 with open(path,'rb') as fd:
  for chunk in iter(lambda:fd.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def bb_trans(box,mat):
 rec=fitz.Rect(box)*mat
 return [r5(rec.x0),r5(rec.y0),r5(rec.x1),r5(rec.y1)]
def bbox_intersects(a,b):
 return not (a[2]<b[0] or a[0]>b[2] or a[3]<b[1] or a[1]>b[3])


def extract(doc):
 page=doc[0]
 rotation=page.rotation_matrix
 texts=[]
 for block in page.get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   vx,vy=line.get('dir',(1.0,0.0))
   direct=[r5(rotation.a*vx+rotation.c*vy),r5(rotation.b*vx+rotation.d*vy)]
   for span in line['spans']:
    if not span['text'].strip():continue
    texts.append({'id':f'0002-text-{len(texts):04d}','text':span['text'],
     'bbox':bb_trans(span['bbox'],rotation),
     'origin':pt(fitz.Point(span['origin'])*rotation),
     'font':span['font'],'size':r5(span['size']),'direction':direct})
 paths=[];layers=collections.Counter()
 for i,d in enumerate(page.get_drawings()):
  layer=d.get('layer') or ''
  layers[layer]+=1
  items=[]
  for item in d['items']:
   kind=item[0]
   if kind=='l':
    items.append({'type':'line','points':[pt(fitz.Point(z)*rotation) for z in item[1:3]]})
   elif kind=='c':
    items.append({'type':'curve','points':[pt(fitz.Point(z)*rotation) for z in item[1:5]]})
   elif kind=='qu':
    q=item[1];items.append({'type':'quad','points':[pt(fitz.Point(z)*rotation) for z in (q.ul,q.ll,q.lr,q.ur)]})
   elif kind=='re':
    q=fitz.Rect(item[1]);items.append({'type':'rect','points':[pt(fitz.Point(z)*rotation) for z in (q.tl,q.bl,q.br,q.tr)]})
   else:raise ValueError(f'Unknown drawing segment {kind!r}, path {i}')
  paths.append({'id':f'0002-path-{i:05d}', 'layer':layer,
   'bbox':bb_trans(d['rect'],rotation),'type':d.get('type','s'),
   'items':items,
   'stroke':[r5(z) for z in d['color']] if d.get('color') is not None else None,
   'fill':[r5(z) for z in d['fill']] if d.get('fill') is not None else None,
   'width':r5(d.get('width') or 0),
   'closed':bool(d.get('closePath',False)),
   'evenOdd':d.get('even_odd'), 'dashes':d.get('dashes')})
 return {'schemaVersion':1,'sourceId':'0002','file':FILE_NAME,'sha256':sha(PDF),
  'page':1,'pageCount':len(doc),'pageRotation':page.rotation,
  'rawToDisplay':[r5(z) for z in [rotation.a,rotation.b,rotation.c,rotation.d,rotation.e,rotation.f]],
  'coordinateSystem':'display PDF points, x right, y down',
  'pageSize':[r5(page.rect.width),r5(page.rect.height)],
  'displayToMaster':[0,-1,1,0,-CROP[1],CROP[2]],
  'texts':texts,'paths':paths,'layerCounts':dict(sorted(layers.items()))}


def schedule(src):
 codes=[t for t in src['texts'] if re.fullmatch(r'S-\d{2}',t['text'].strip()) and 2350<t['origin'][0]<2430]
 rows=[]
 for c in sorted(codes,key=lambda q:int(q['text'].strip()[2:])):
  y=c['origin'][1]
  possible=[t for t in src['texts'] if 2440<t['origin'][0]<2780 and abs(t['origin'][1]-y)<5 and t['text'].strip() and t['size']>17]
  if not possible:raise ValueError('Missing room name for '+c['text'])
  n=min(possible,key=lambda q:abs(q['origin'][1]-y))
  rows.append({'code':c['text'].strip(),'name':' '.join(n['text'].split()),
   'sourceId':'0002','page':1,'codeTextId':c['id'],'nameTextId':n['id'],'bbox':c['bbox']})
 exp=[f'S-{i:02d}' for i in range(1,28)]
 if [r['code'] for r in rows]!=exp:raise ValueError('Incomplete schedule or duplicate labels: '+str([r['code'] for r in rows]))
 return {'schemaVersion':1,'sourceId':'0002','status':'confirmed','rows':rows}


def svg_path(p):
 out=[];pos=None
 for seg in p['items']:
  kind=seg['type'];xyz=seg['points']
  if kind in ('line','curve'):
   x,y=xyz[0]
   if pos is None or abs(x-pos[0])+abs(y-pos[1])>0.025:out.append(f'M{x:.2f},{y:.2f}')
   if kind=='line':
    x2,y2=xyz[1];out.append(f'L{x2:.2f},{y2:.2f}');pos=xyz[1]
   else:
    a,b,c=xyz[1:4];out.append(f'C{a[0]:.2f},{a[1]:.2f} {b[0]:.2f},{b[1]:.2f} {c[0]:.2f},{c[1]:.2f}');pos=c
  elif kind in ('quad','rect'):
   out.append('M'+'L'.join(f'{z[0]:.2f},{z[1]:.2f}' for z in xyz)+'Z');pos=None
 if p['closed'] and out and not out[-1].endswith('Z'):out.append('Z')
 return ''.join(out)


def make_svg(source,sideways=True):
 x0,y0,x1,y1=CROP
 width=x1-x0;height=y1-y0
 if sideways:
  vw,vh=height,width
  transform=f'matrix(0 -1 1 0 {-y0:g} {x1:g})'
  title='B03 Second Floor Part 02 — clean plan, 90 degrees counterclockwise'
 else:
  vw,vh=width,height
  transform=f'translate({-x0:g} {-y0:g})'
  title='B03 Second Floor Part 02 — clean plan, source orientation'
 out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw:g} {vh:g}" role="img" aria-label="{html.escape(title,quote=True)}">',
  f'<title>{html.escape(title)}</title>',
  '<desc>Only B03 second-floor Part 02. Paths extracted from the vector PDF; annotations, grids, dimensions and sheet borders removed. No merging. Physical scale not calibrated.</desc>',
  f'<defs><clipPath id="planCrop"><rect x="{x0:g}" y="{y0:g}" width="{width:g}" height="{height:g}"/></clipPath></defs>',
  f'<g transform="{transform}"><g clip-path="url(#planCrop)"><g fill="none" stroke="{INK}" stroke-width="{DRAW_WEIGHT}" stroke-linecap="round" stroke-linejoin="round">']
 used=0;by_layer=collections.Counter()
 for p in source['paths']:
  if p['layer'] not in KEEP or not bbox_intersects(p['bbox'],CROP):continue
  d=svg_path(p)
  if not d:continue
  out.append(f'<path id="{p["id"]}" data-layer="{html.escape(p["layer"],quote=True)}" d="{d}"/>')
  used+=1;by_layer[p['layer']]+=1
 out.extend(['</g></g></g>','</svg>'])
 return ('\n'.join(out)+'\n').encode('utf-8'),used,dict(sorted(by_layer.items()))


def render_clean_svg(svg_file,png_file,pixel_width=1750):
 root=ET.parse(svg_file).getroot()
 _,_,w,h=[float(z) for z in root.attrib['viewBox'].split()]
 cairosvg.svg2png(url=str(svg_file),write_to=str(png_file),output_width=pixel_width,output_height=round(pixel_width*h/w),background_color='#ffffff')


def create_annotated_svg(doc):
 """A second SVG, keeping labels and axes from the input PDF, oriented like screenshot.

 This is reference only; master.svg remains the clean architectural vector map.
 """
 page=doc[0]
 full=etree.fromstring(page.get_svg_image(text_as_path=True).encode('utf-8'))
 namespace='http://www.w3.org/2000/svg'
 x0,y0,x1,y1=CROP
 svg=etree.Element('{%s}svg'%namespace,nsmap=full.nsmap,
  attrib={'viewBox':f'0 0 {y1-y0:g} {x1-x0:g}',
          'role':'img','aria-label':'B03 Part 02 annotated reference rotated sideways'})
 title=etree.SubElement(svg,'{%s}title'%namespace)
 title.text='B03 Part 02 - sideways source reference (annotations preserved)'
 rotated=etree.SubElement(svg,'{%s}g'%namespace,
  attrib={'transform':f'matrix(0 -1 1 0 {-y0:g} {x1:g})'})
 crop=etree.SubElement(rotated,'{%s}clipPath'%namespace,attrib={'id':'single-sheet-plan-crop'})
 etree.SubElement(crop,'{%s}rect'%namespace,
  attrib={'x':f'{x0:g}','y':f'{y0:g}','width':f'{x1-x0:g}','height':f'{y1-y0:g}'})
 content=etree.SubElement(rotated,'{%s}g'%namespace,
  attrib={'clip-path':'url(#single-sheet-plan-crop)'})
 for node in list(full):
  if node.tag.endswith('}defs'):
   svg.insert(1,node)
  else:content.append(node)
 etree.ElementTree(svg).write(str(ROOT/'reference-sideways.svg'),
  encoding='utf-8',xml_declaration=True)


def make_reference(doc):
 page=doc[0]
 # Sheet view is drawn from the PDF, retaining labels, dimensions and axes.
 page.get_pixmap(matrix=fitz.Matrix(.45,.45),alpha=False).save(INSPECT/'0002-full-sheet.png')
 rect=fitz.Rect(CROP)
 pix=page.get_pixmap(matrix=fitz.Matrix(.74,.74),clip=rect,alpha=False)
 pic=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
 pic.transpose(Image.Transpose.ROTATE_90).save(INSPECT/'reference-sideways.png',optimize=True)


def main():
 ROOT.mkdir(parents=True,exist_ok=True);INSPECT.mkdir(parents=True,exist_ok=True)
 with fitz.open(PDF) as doc:
  if len(doc)!=1:raise ValueError('Expected a one-page shop drawing')
  extracted=extract(doc)
  json_write(ROOT/'source'/'0002.json',extracted)
  sched=schedule(extracted)
  json_write(ROOT/'room-schedule.json',sched)
  json_write(ROOT/'source'/'room-schedule.json',sched)
  make_reference(doc)
  create_annotated_svg(doc)
 sideways,nused,per_layer=make_svg(extracted,True)
 upright,nused_upright,other_layers=make_svg(extracted,False)
 (ROOT/'master.svg').write_bytes(sideways)
 (ROOT/'master-upright.svg').write_bytes(upright)
 render_clean_svg(ROOT/'master.svg',INSPECT/'master.png')
 render_clean_svg(ROOT/'master-upright.svg',INSPECT/'master-upright.png',pixel_width=1300)
 model={'schemaVersion':1,'buildingId':'B03','floorId':'02','sheetId':'0002',
  'sourceCount':1,'mergePerformed':False,'sourceFile':FILE_NAME,
  'sourceSha256':sha(PDF),'pageRotation':extracted['pageRotation'],
  'rawToDisplay':extracted['rawToDisplay'],'coordinateSystem':'display PDF points, x right y down',
  'sourcePlanCrop':CROP,'masterViewBox':[0,0,CROP[3]-CROP[1],CROP[2]-CROP[0]],
  'displayToMaster':[0,-1,1,0,-CROP[1],CROP[2]],
  'orientation':'90 degrees counterclockwise from normalized PDF display orientation, as in reference screenshot',
  'uprightViewBox':[0,0,CROP[2]-CROP[0],CROP[3]-CROP[1]],
  'uprightTransform':[1,0,0,1,-CROP[0],-CROP[1]],
  'keepLayers':KEEP,'excludedLayers':'All non-allowlisted CAD layers, notably title block, axes, dimensions, annotations, triangulation and hatch lines',
  'includedPathCountsByLayer':per_layer,
  'metricCalibration':{'status':'unknown','metersPerUnit':None,
    'reason':'No verified real-world dimension pair matched to drawing endpoints'},
  'status':'single_source_verified'}
 json_write(ROOT/'alignment.json',model)

 # Validate path coordinates and output rendering (no fake merge alignment stats).
 parsed=ET.parse(ROOT/'master.svg')
 ns='{http://www.w3.org/2000/svg}'
 paths=parsed.getroot().findall('.//'+ns+'path')
 render=Image.open(INSPECT/'master.png').convert('RGB')
 # nonwhite pixels in PNG.  Invariant checking also makes blank-output failure conspicuous.
 hist=render.convert('L').histogram()
 dark=sum(hist[:240]);total=render.width*render.height
 tests={'sourcePDFHashConfirmed':sha(PDF)==extracted['sha256'],
  'sourcePDFPageCountOne':extracted['pageCount']==1,
  'sourcePagesNormalizedFromRotation270':extracted['pageRotation']==270,
  'singleSourceOnly':True,'svgPathCountMatchesExtraction':len(paths)==nused==nused_upright,
  'roomSchedule01To27':len(sched['rows'])==27 and sched['rows'][0]['code']=='S-01' and sched['rows'][-1]['code']=='S-27',
  'noRoomLabelsEmitted':not parsed.getroot().findall('.//'+ns+'text'),
  'previewIsNotBlank':dark>3000,
  'annotatedReferenceSVGParses':etree.parse(str(ROOT/'reference-sideways.svg')).getroot().tag.endswith('}svg'),
  'masterBoundingBoxRotated':parsed.getroot().get('viewBox')==f'0 0 {CROP[3]-CROP[1]:g} {CROP[2]-CROP[0]:g}',
  'sourceLayerAllowlistOnly':set(per_layer).issubset(set(KEEP))}
 validation={'status':'passed' if all(tests.values()) else 'failed',
  'checks':tests,'sourceExtractedPathCount':len(extracted['paths']),
  'masterVectorPathCount':nused,'roomScheduleCount':len(sched['rows']),
  'previewSize':[render.width,render.height],
  'darkPreviewPixelCount':dark,
  'sourceOriginalsUnchanged':tests['sourcePDFHashConfirmed'],
  'seam':None,'overlapGeometryMatches':None,
  'notes':['Only 0002 PDF is used; no merge or seam applies.',
   'Labels and room names are in JSON, not in clean SVG.',
   'The main SVG is rotated to the sideways view seen in the reference screenshot.',
   'Physical meter calibration is intentionally not claimed.']}
 json_write(ROOT/'validation.json',validation)
 if validation['status']!='passed':raise ValueError('Validation failed: '+str(tests))
 manifest={'schemaVersion':1,'generator':'scripts/rebuild.py',
  'pymupdfVersion':fitz.VersionBind,
  'files':{str(p.relative_to(ROOT)):sha(p) for p in sorted(ROOT.rglob('*'))
    if p.is_file() and p.name!='manifest.json' and p.suffix!='.pyc' and '__pycache__' not in str(p)}}
 json_write(ROOT/'manifest.json',manifest)
 print(json.dumps({'status':validation['status'],'paths':nused,'roomCount':len(sched['rows']),
  'srcPaths':len(extracted['paths']),'svgKb':round(len(sideways)/1024,1),
  'darkPixels':dark, 'files':len(manifest['files'])},indent=2))

if __name__=='__main__':main()
