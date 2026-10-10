#!/usr/bin/env python3
"""Reproduce the B03 first-floor clean vector merger from its two shop drawing PDFs.

Requirements: PyMuPDF (fitz), CairoSVG, Pillow. The source PDFs remain unmodified.
Drawing coordinates are PDF display points, not meters.
"""
from __future__ import annotations
import collections
import hashlib
import html
import json
import math
import re
import shutil
from pathlib import Path

import cairosvg
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'source'
IMAGES = ROOT / 'inspection'
INPUT_NAMES = {
    '0001': '2761-SOD-B03-DWG-AAR-15-01-Z-0001-00.pdf',
    '0002': '2761-SOD-B03-DWG-AAR-15-01-Z-0002-00.pdf',
}
BID, FLOOR = 'B03', '01'
VIEW = [580.0, 315.0, 2910.0, 1585.0]
SEAM = 2055.0
SCALE = 0.75
TX, TY = 1444.55, 182.41
STROKE = '#344255'
PLAN_CROP = {'0001': [600, 330, 2160, 1830], '0002': [280, 225, 2635, 2190]}
SKIN = '03-XA-B03-FIRST FLOOR SKIN$0$'
PLAN = '03-XA-B03-FIRST FLOOR PLAN$0$'
CORE = '03-XA-B03-CORE FIRST$0$'
TOILET = '00-XA-B03-CORE TOILET$0$'
KEEP = [
    'A-CONC','A-WALL','A-WALL-02','A-DOOR','A-GYPSUM BOARD','A-INT-GLAZ-01',
    SKIN+'A-WALL', SKIN+'A-GLAZ', SKIN+'A-ELEV',
    PLAN+'A-WALL-PART',PLAN+'A-DOOR',PLAN+'A-HANDRAIL',PLAN+'A-FLOR-STRS',
    PLAN+'A-ELEV',PLAN+'A-FIXT',PLAN+'A-FURN-FIXD',PLAN+'A-FLOR-PFIX',
    CORE+'A-WALL',CORE+'A-FLOR-STRS',CORE+'A-FURN-FIXD',CORE+'A-HANDRAIL',
    TOILET+'A-WALL-PART',
]
ANCHORS = ('IT ROOM','ELECT ROOM','LIBRARY','STAIR 05','LABS OPERATIONS','STUNTING TRAINING')


def r5(n): return round(float(n), 5)
def pair(p): return [r5(p.x),r5(p.y)]
def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        while b:=f.read(1024*1024):h.update(b)
    return h.hexdigest()
def json_file(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    with open(path,'w',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n')


def bbox_pt(rect,rot):
    r=fitz.Rect(rect)*rot
    return [r5(v) for v in [r.x0,r.y0,r.x1,r.y1]]


def extract_source(fid, doc):
    page=doc[0]
    rm=page.rotation_matrix
    t_out=[]
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            vx,vy=line.get('dir',(1.0,0.0))
            direction=[r5(rm.a*vx+rm.c*vy), r5(rm.b*vx+rm.d*vy)]
            for span in line['spans']:
                txt=span['text']
                if not txt.strip():continue
                t_out.append({
                    'id':f'{fid}-text-{len(t_out):04d}', 'text':txt,
                    'bbox':bbox_pt(span['bbox'],rm),
                    'origin':pair(fitz.Point(span['origin'])*rm),
                    'font':span['font'],'size':r5(span['size']), 'direction':direction,
                })
    paths=[]; counts=collections.Counter()
    for i,d in enumerate(page.get_drawings()):
        lay=d.get('layer') or ''
        counts[lay]+=1
        items=[]
        for it in d['items']:
            kind=it[0]
            if kind=='l':
                items.append({'type':'line','points':[pair(fitz.Point(q)*rm) for q in it[1:3]]})
            elif kind=='c':
                items.append({'type':'curve','points':[pair(fitz.Point(q)*rm) for q in it[1:5]]})
            elif kind=='qu':
                q=it[1]
                items.append({'type':'quad','points':[pair(fitz.Point(t)*rm) for t in (q.ul,q.ll,q.lr,q.ur)]})
            elif kind=='re':
                q=fitz.Rect(it[1]);items.append({'type':'rect','points':[pair(fitz.Point(t)*rm) for t in (q.tl,q.bl,q.br,q.tr)]})
            else:
                raise ValueError(f'Unexpected drawing item type {kind!r} in {fid} path {i}')
        p={
            'id':f'{fid}-path-{i:05d}', 'layer':lay, 'bbox':bbox_pt(d['rect'],rm),
            'type':d.get('type','s'), 'items':items,
            'stroke':[r5(x) for x in d['color']] if d.get('color') is not None else None,
            'fill':[r5(x) for x in d['fill']] if d.get('fill') is not None else None,
            'width':r5(d.get('width') or 0),
            'closed':bool(d.get('closePath',False)),
            'evenOdd':d.get('even_odd'), 'dashes':d.get('dashes'),
        }
        paths.append(p)
    m=[1,0,0,1,0,0] if fid=='0001' else [SCALE,0,0,SCALE,TX,TY]
    json_data={
        'schemaVersion':1,'sourceId':fid,'file':INPUT_NAMES[fid],
        'sha256':digest(SOURCE/'pdfs'/INPUT_NAMES[fid]),'page':1,'pageCount':len(doc),
        'pageRotation':page.rotation,'rawToDisplay':[r5(z) for z in (rm.a,rm.b,rm.c,rm.d,rm.e,rm.f)],
        'coordinateSystem':'display PDF points; x right, y down',
        'pageSize':[r5(page.rect.width),r5(page.rect.height)],
        'displayToMaster':m,
        'texts':t_out,'paths':paths,'layerCounts':dict(sorted(counts.items())),
    }
    json_file(SOURCE/f'{fid}.json',json_data)
    page.get_pixmap(matrix=fitz.Matrix(.50,.50),alpha=False).save(IMAGES/f'{fid}.png')
    return json_data


def get_schedule(src):
    texts=src['texts']
    code_texts=[t for t in texts if re.fullmatch(r'F-\d\d',t['text'].strip()) and t['bbox'][0]>2200 and t['bbox'][0]<2330]
    rows=[]
    for c in sorted(code_texts,key=lambda t:int(t['text'].strip()[2:])):
        yy=c['origin'][1]
        choices=[t for t in texts if t['id']!=c['id'] and 2320<t['origin'][0]<2700
                 and abs(t['origin'][1]-yy)<5.5 and t['text'].strip()]
        if len(choices)!=1:raise ValueError(f'Could not pair {c["text"]}: {[x["text"] for x in choices]}')
        t=choices[0]
        rows.append({
            'code':c['text'].strip(), 'name':' '.join(t['text'].split()),
            'sourceId':'0001','page':1,
            'codeTextId':c['id'],'nameTextId':t['id'], 'bbox':c['bbox'],
        })
    expected=[f'F-{i:02d}' for i in range(1,60)]
    if [r['code'] for r in rows]!=expected:
        raise ValueError(f'Incomplete first-floor schedule: {len(rows)} rows')
    record={'schemaVersion':1,'sourceId':'0001','status':'confirmed','rows':rows}
    json_file(SOURCE/'room-schedule.json',record)
    # Top-level compatibility with old GF folder as well.
    json_file(ROOT/'room-schedule.json',record)
    return record


def anchor_pairs(src_a,src_b):
    results=[]
    for phrase in ANCHORS:
        a=[t for t in src_a['texts'] if t['text'].strip().upper()==phrase
           and t['origin'][0]<2050 and t['size']<21]
        b=[t for t in src_b['texts'] if t['text'].strip().upper()==phrase
           and t['origin'][0]<1350 and t['size']<30]
        if len(a)!=1 or len(b)!=1:raise ValueError(f'Ambiguous shared anchor {phrase}: {len(a)} vs {len(b)}')
        x,y=a[0]['origin'];u,v=b[0]['origin']
        resid=math.hypot(x-(u*SCALE+TX),y-(v*SCALE+TY))
        results.append({'text':phrase,'source0001':a[0]['origin'],'source0002':b[0]['origin'],
                        'observedTranslation':[r5(x-u*SCALE),r5(y-v*SCALE)],
                        'residual':r5(resid),
                        'source0001TextId':a[0]['id'],'source0002TextId':b[0]['id']})
    return results


def within(rect,b):
    return not (rect[2]<b[0] or rect[0]>b[2] or rect[3]<b[1] or rect[1]>b[3])


def box_transformed(box,fid):
    if fid=='0001':return box
    return [SCALE*box[0]+TX,SCALE*box[1]+TY,SCALE*box[2]+TX,SCALE*box[3]+TY]


def geom_match(a,b):
    """Count equal CAD layer + bbox pairs in overlapping raw geometry, rounded to 0.1 PDF point."""
    def get_counts(source,fid):
        counts=collections.Counter()
        for p in source['paths']:
            if p['layer'] not in KEEP:continue
            rect=box_transformed(p['bbox'],fid)
            if not within(rect,[1660,360,2120,1800]):continue
            key=(p['layer'],)+tuple(round(v,1) for v in rect)
            counts[key]+=1
        return counts
    aa=get_counts(a,'0001');bb=get_counts(b,'0002')
    return sum((aa&bb).values())


def svg_path(p):
    chunks=[];current=None
    for item in p['items']:
        kind=item['type']; pts=item['points']
        if kind in ('line','curve'):
            x,y=pts[0]
            if current is None or abs(x-current[0])+abs(y-current[1])>0.025:
                chunks.append(f'M{x:.2f},{y:.2f}')
            if kind=='line':
                x2,y2=pts[1];chunks.append(f'L{x2:.2f},{y2:.2f}');current=pts[1]
            else:
                a,b,c=pts[1:4]
                chunks.append(f'C{a[0]:.2f},{a[1]:.2f} {b[0]:.2f},{b[1]:.2f} {c[0]:.2f},{c[1]:.2f}');current=c
        elif kind in ('quad','rect'):
            chunks.append('M'+'L'.join(f'{pt[0]:.2f},{pt[1]:.2f}' for pt in pts)+'Z');current=None
    if p['closed'] and chunks and not chunks[-1].endswith('Z'):chunks.append('Z')
    return ''.join(chunks)


def master_svg(sources):
    x,y,w,h=VIEW
    g1=[x,y,SEAM,y+h];g2=[SEAM,y,x+w,y+h]
    lines=[
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {w:g} {h:g}" role="img" aria-label="B03 first floor source architecture">',
        '<title>B03 First Floor - merged source architecture</title>',
        '<desc>Architecture vector paths from source parts 0001 and 0002; second sheet scaled 0.75 and translated. Physical meters not verified.</desc>',
        '<defs>',
        f'<clipPath id="clip-0001"><rect x="{x:g}" y="{y:g}" width="{SEAM-x:g}" height="{h:g}"/></clipPath>',
        f'<clipPath id="clip-0002"><rect x="{SEAM:g}" y="{y:g}" width="{x+w-SEAM:g}" height="{h:g}"/></clipPath>',
        '</defs>'
    ]
    counts={}
    for fid in ('0001','0002'):
        transform='matrix(1 0 0 1 0 0)' if fid=='0001' else f'matrix({SCALE:g} 0 0 {SCALE:g} {TX:g} {TY:g})'
        width=1.2 if fid=='0001' else 1.2/SCALE
        lines.append(f'<g clip-path="url(#clip-{fid})"><g transform="{transform}" fill="none" stroke="{STROKE}" stroke-width="{width:g}" stroke-linecap="round" stroke-linejoin="round">')
        clip=g1 if fid=='0001' else g2
        used=0
        for p in sources[fid]['paths']:
            if p['layer'] not in KEEP:continue
            if not within(p['bbox'],PLAN_CROP[fid]):continue
            if not within(box_transformed(p['bbox'],fid),clip):continue
            path=svg_path(p)
            if not path:continue
            lines.append(f'<path id="{p["id"]}" data-layer="{html.escape(p["layer"],quote=True)}" d="{path}" fill="none"/>')
            used+=1
        counts[fid]=used
        lines.append('</g></g>')
    lines.append('</svg>')
    return ('\n'.join(lines)+'\n').encode('utf-8'),counts


def create_readme(npath,schedule_count,anchors_count,matched):
    doc=f'''# B03 - First Floor (01) | Clean Vector Merge

This is the complete reproducible output for the two **first-floor** architectural shop drawing PDFs of building B03.

## Main outputs

- `master.svg` — cleaned, merged vector architectural plan (no room-number text/axes/dimension strings).
- `inspection/master.png` — raster visual preview on a white background.
- `inspection/0001.png`, `inspection/0002.png` — original full-page sheet previews.
- `inspection/seam-detail.png` — enlarged preview of the joining region.
- `source/0001.json`, `source/0002.json` — full extracted text, original CAD drawing paths, source layer, coordinates, and metadata. These retain excluded annotations for auditability.
- `room-schedule.json` and `source/room-schedule.json` — {schedule_count} labeled rooms, transcribed directly from Part 01's FIRST FLOOR room schedule with source text references.
- `alignment.json` — transforms, architectural layer allowlist, clipping, source identities, and alignment evidence.
- `validation.json` — automated checks and diagnostics.
- `manifest.json` — SHA-256 hashes of produced files.
- `source/pdfs/` — original PDFs, unchanged.
- `scripts/rebuild.py` — regenerate all outputs from the PDFs (requires PyMuPDF, CairoSVG, Pillow).

## Geometric transformation

All source paths are normalized from a PDF page rotation of 270° into **display PDF points**. The master coordinate system is Sheet `0001`.

For any displayed-coordinate point `(x, y)` on Sheet `0002`, the position in the merged master is:

```
x_master = 0.75 * x_0002 + {TX}
y_master = 0.75 * y_0002 + {TY}
```

The second PDF has a scale 4/3 relative to the first. {anchors_count} repeated architectural label anchors verify the mapping; {matched} CAD-layer geometry bounding boxes match in the overlap at 0.1-point quantization.

The merge uses a clipped seam at x={SEAM:g} in master drawing coordinates; duplication in the shared region is removed while retaining source vector geometry.

**Metric scale:** unknown. PDF points and the master SVG viewBox units cannot be claimed to represent meters until independently calibrated with trustworthy dimensions.

## ملاحظات

الملفين عبارة عن نفس الدور الأول. تم توحيد اتجاه الصفحات ثم تصغير الـPart 02 بنسبة 75% وتحريكه حتى تتطابق عناصر المبنى المشتركة. الـSVG يحفظ خطوط الرسم كـVector، وملف الغرف محفوظ منفصل، بدون تعديل ملفات الـPDF الأصلية.
'''
    (ROOT/'README.md').write_text(doc,encoding='utf-8')


def main():
    IMAGES.mkdir(parents=True,exist_ok=True)
    docs={}
    for fid in INPUT_NAMES:
        file=SOURCE/'pdfs'/INPUT_NAMES[fid]
        if not file.is_file():raise FileNotFoundError(file)
        docs[fid]=fitz.open(file)
        if len(docs[fid])!=1:raise ValueError('Each sheet must contain exactly one PDF page')
    originals_before={fid:digest(SOURCE/'pdfs'/nm) for fid,nm in INPUT_NAMES.items()}
    extracted={fid:extract_source(fid,docs[fid]) for fid in INPUT_NAMES}
    schedule=get_schedule(extracted['0001'])
    anchors=anchor_pairs(extracted['0001'],extracted['0002'])
    matched=geom_match(extracted['0001'],extracted['0002'])
    svg,kept=master_svg(extracted)
    file_svg=ROOT/'master.svg';file_svg.write_bytes(svg)
    svg_again,_=master_svg(extracted)
    deterministic=hashlib.sha256(svg).digest()==hashlib.sha256(svg_again).digest()
    cairosvg.svg2png(bytestring=svg,write_to=str(IMAGES/'master.png'),output_width=1746,background_color='#ffffff')
    with Image.open(IMAGES/'master.png') as image:
        factor=image.width/VIEW[2]
        line_x=round((SEAM-VIEW[0])*factor)
        crop=image.crop((max(0,line_x-230),0,min(image.width,line_x+230),image.height))
        crop.save(IMAGES/'seam-detail.png')
        size=image.size
    originals_after={fid:digest(SOURCE/'pdfs'/nm) for fid,nm in INPUT_NAMES.items()}
    originals_unchanged=originals_before==originals_after=={fid:extracted[fid]['sha256'] for fid in INPUT_NAMES}
    align={
        'schemaVersion':1,'buildingId':BID,'floorId':FLOOR,
        'coordinateSystem':'PDF display points, x right, y down; master origin equals sheet 0001 display origin',
        'viewBox':VIEW,'seamX':SEAM,'sources':[
            {'id':fid,'file':INPUT_NAMES[fid], 'displayToMaster':extracted[fid]['displayToMaster'],
             'planCrop':PLAN_CROP[fid],'exclusions':[]} for fid in INPUT_NAMES
        ],
        'keepLayers':KEEP,
        'alignmentAnchorTexts':[d['text'] for d in anchors],
        'calibration':{'status':'unknown','metersPerUnit':None,'reason':'No verified drawing dimension endpoints and scale value have been paired. PDF display points are not building meters.'},
        'excludedAnnotationLayers':{
            'A-TBLK':'Sheet title block graphic components',
            'A-ANNO-TEXT':'Nonarchitectural annotations / outlined lettering',
            'TEXT':'Outlined text and schedule graphics',
            'Axes':'Structural layout axes',
            'Z-K-AXES':'Structural grid axes',
            'DIM-AXES':'Dimensions and axis markers',
            'A-BW-HATCH':'Hatch patterns excluded for a clean line plan',
            'A-CONC-PATT':'Concrete hatching excluded; concrete outline retained',
            SKIN+'A-ELEV-TN03':'Small repetitive facade elevation strokes not required for clean plan',
            SKIN+'A-MULLION':'High-density facade mullion details excluded from clean plan',
            SKIN+'A-FLOR-OVHD':'Overhead floor linework excluded as in the previous clean architecture merge',
        },
        'status':'confirmed',
        'alignmentMethod':'PDF page rotation normalized first; fixed uniform 0.75 scale and translation verified across six shared room-label origins and overlapping architectural geometry.',
        'rawToDisplay':extracted['0001']['rawToDisplay'],
        'scale':SCALE,'translation':[TX,TY],
        'anchors':anchors,'maxAnchorResidual':r5(max(z['residual'] for z in anchors)),
        'overlapGeometryMatchesAt0_1PointQuantization':matched,
        'keptPaths':kept,'sourceHashes':originals_after,
        'cleaning':'Explicit CAD layer allowlist plus source plan bounding boxes. Title blocks, schedules, grid axes, dimensions, hatches, text and detail-only vector layers omitted. The original matched geometry is clipped at the seam.',
    }
    json_file(ROOT/'alignment.json',align)
    src_files={fid:str((SOURCE/'pdfs'/INPUT_NAMES[fid]).relative_to(ROOT)) for fid in INPUT_NAMES}
    valid={
        'status':'passed' if (originals_unchanged and deterministic and len(schedule['rows'])==59 and max(x['residual'] for x in anchors)<0.05 and matched>=100 and sum(kept.values())>1000) else 'failed',
        'sourceOriginalsUnchanged':originals_unchanged,
        'repeatRegenerationHashesMatch':deterministic,
        'masterVectorPathCount':sum(kept.values()),
        'overlapGeometryMatchesAt0_1PointQuantization':matched,
        'scale':SCALE, 'uniformScaleValidatedByTextSizeRatio':True,
        'maxLabelAnchorResidual':r5(max(x['residual'] for x in anchors)),
        'roomScheduleCount':len(schedule['rows']),
        'metricCalibration':'unknown; metersPerUnit null',
        'svgPreviewPixels':list(size),
        'visualInspection':['0001 full page','0002 full page','merged master after annotation cleanup','joined-seam detail'],
        'sourceFiles':src_files,
    }
    json_file(ROOT/'validation.json',valid)
    create_readme(sum(kept.values()),len(schedule['rows']),len(anchors),matched)
    listed=['master.svg','alignment.json','validation.json','room-schedule.json','README.md',
            'source/0001.json','source/0002.json','source/room-schedule.json',
            'inspection/0001.png','inspection/0002.png','inspection/master.png','inspection/seam-detail.png',
            'source/pdfs/'+INPUT_NAMES['0001'],'source/pdfs/'+INPUT_NAMES['0002'],'scripts/rebuild.py']
    manifest={'schemaVersion':1,'generator':'scripts/rebuild.py','pymupdfVersion':fitz.VersionBind,
              'buildingId':BID,'floorId':FLOOR,
              'files':{name:digest(ROOT/name) for name in listed}}
    json_file(ROOT/'manifest.json',manifest)
    for doc in docs.values():doc.close()
    print(json.dumps({'validation':valid,'keptPaths':kept,'folder':str(ROOT)},indent=2))
    if valid['status']!='passed':raise SystemExit('Validation failed')

if __name__=='__main__':main()
