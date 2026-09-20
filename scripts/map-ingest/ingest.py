"""Deterministic source-vector extraction and explicitly aligned B03 GF SVG.
Run from any directory: python scripts/map-ingest/ingest.py
Requires PyMuPDF==1.28.2. Originals are never modified.
"""
from pathlib import Path
import collections, hashlib, html, json, math
import pymupdf as fitz
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'maps/B03/GF'
CONFIG = json.loads((Path(__file__).with_name('config.json')).read_text(encoding='utf-8-sig'))

def number(x): return round(float(x), 5)
def point(p): return [number(p.x), number(p.y)]
def rect(r): return [number(v) for v in r]
def write_json(path, obj): path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
def transform_item(item, matrix):
    kind=item[0]
    if kind == 're':
        r=item[1]; pts=[r.tl,r.tr,r.br,r.bl]
        return {'type':'rect','points':[point(p*matrix) for p in pts], 'orientation':item[2]}
    if kind == 'qu':
        q=item[1]
        return {'type':'quad','points':[point(p*matrix) for p in [q.ul,q.ur,q.lr,q.ll]]}
    return {'type':{'l':'line','c':'cubic'}[kind], 'points':[point(p*matrix) for p in item[1:]]}
def svg_d(items):
    parts=[]
    for it in items:
        pts=it['points']; xy=lambda p: f'{p[0]:g},{p[1]:g}'
        if it['type']=='line': parts.append('M'+xy(pts[0])+'L'+xy(pts[1]))
        elif it['type']=='cubic': parts.append('M'+xy(pts[0])+'C'+' '.join(xy(p) for p in pts[1:]))
        else: parts.append('M'+xy(pts[0])+'L'+' '.join(xy(p) for p in pts[1:])+'Z')
    return ' '.join(parts)
def intersects(a,b): return a[0]<=b[2] and a[2]>=b[0] and a[1]<=b[3] and a[3]>=b[1]
def contains(a,b): return a[0]<=b[0] and a[1]<=b[1] and a[2]>=b[2] and a[3]>=b[3]
def extract(source):
    path=ROOT/source['file']; doc=fitz.open(path); page=doc[0]; m=page.rotation_matrix
    spans=[]
    for b in page.get_text('dict')['blocks']:
        for line in b.get('lines',[]):
            for s in line['spans']:
                origin=point(fitz.Point(s['origin'])*m)
                spans.append({'id':f"{source['id']}-text-{len(spans):04d}", 'text':s['text'], 'bbox':rect(fitz.Rect(s['bbox'])*m), 'origin':origin, 'font':s['font'], 'size':number(s['size']), 'direction':point(fitz.Point(line['dir'])*fitz.Matrix(m.a,m.b,m.c,m.d,0,0))})
    drawings=[]
    for i,d in enumerate(page.get_drawings()):
        drawings.append({'id':f"{source['id']}-path-{i:05d}", 'layer':d['layer'], 'bbox':rect(d['rect']*m), 'type':d['type'], 'items':[transform_item(it,m) for it in d['items']], 'stroke':list(d['color']) if d['color'] else None, 'fill':list(d['fill']) if d['fill'] else None, 'width':number(d['width']), 'closed':d['closePath'], 'evenOdd':d['even_odd'], 'dashes':d['dashes']})
    result={'schemaVersion':1,'sourceId':source['id'],'file':source['file'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'page':1,'pageCount':len(doc),'pageRotation':page.rotation,'rawToDisplay':list(m),'coordinateSystem':'display PDF points; x right, y down','pageSize':[page.rect.width,page.rect.height], 'displayToMaster':source['displayToMaster'],'texts':spans,'paths':drawings,'layerCounts':dict(sorted(collections.Counter(d['layer'] for d in drawings).items()))}
    write_json(OUT/'source'/f"{source['id']}.json",result)
    page.get_pixmap(matrix=fitz.Matrix(.8,.8),alpha=False).save(OUT/'inspection'/f"{source['id']}.png")
    return result

def main():
    for sub in ['source','inspection']: (OUT/sub).mkdir(parents=True,exist_ok=True)
    data=[extract(s) for s in CONFIG['sources']]
    schedule=[]
    spans=data[1]['texts']
    for i,t in enumerate(spans):
        if t['text'].startswith('G-') and t['text'][2:].isdigit():
            following=spans[i+1]
            schedule.append({'code':t['text'],'name':following['text'].strip(),'sourceId':'0002','page':1,'codeTextId':t['id'],'nameTextId':following['id'],'bbox':t['bbox']})
    if [r['code'] for r in schedule] != [f'G-{i:02d}' for i in range(1,55)]: raise ValueError('Room schedule must contain G-01 through G-54')
    write_json(OUT/'source/room-schedule.json',{'schemaVersion':1,'sourceId':'0002','status':'confirmed','rows':schedule})
    anchors=[]
    for name in CONFIG['alignmentAnchorTexts']:
        matches=[]
        for src,d in zip(CONFIG['sources'],data):
            matches.append([t for t in d['texts'] if t['text']==name and intersects(t['bbox'],src['planCrop'])])
        # Select the corresponding pair nearest the configured translation; schedule text is outside planCrop.
        candidates=[(math.dist(a['origin'],[b['origin'][0]+1033.29,b['origin'][1]-28.35]),a,b) for a in matches[0] for b in matches[1]]
        residual,a,b=min(candidates,key=lambda x:x[0])
        anchors.append({'text':name,'source0001':a['origin'],'source0002':b['origin'],'observedTranslation':[number(a['origin'][k]-b['origin'][k]) for k in range(2)],'residual':number(residual)})
    if max(a['residual'] for a in anchors)>.02: raise ValueError('Source alignment anchor mismatch')
    vb=CONFIG['viewBox']; seam=CONFIG['seamX']; pieces=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+' '.join(str(v) for v in vb)+'" role="img" aria-label="B03 ground floor source architecture">', '<title>B03 Ground Floor - merged source architecture</title>', '<desc>Vector geometry from drawing parts 0001 and 0002; drawing units only, physical scale unverified.</desc>', '<defs>']
    for s in CONFIG['sources']:
        crop=s['planCrop']; dx,dy=s['displayToMaster'][4:]; left=max(crop[0]+dx,seam if s['id']=='0002' else vb[0]); right=min(crop[2]+dx,seam if s['id']=='0001' else vb[0]+vb[2]); top=crop[1]+dy; bottom=crop[3]+dy
        pieces.append(f'<clipPath id="clip-{s["id"]}"><rect x="{left:g}" y="{top:g}" width="{right-left:g}" height="{bottom-top:g}"/></clipPath>')
    pieces.append('</defs>')
    kept={}
    for s,d in zip(CONFIG['sources'],data):
        pieces.append(f'<g clip-path="url(#clip-{s["id"]})"><g transform="matrix({" ".join(str(v) for v in s["displayToMaster"])})" fill="none" stroke="#344255" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">')
        kept[s['id']]=0
        for p in d['paths']:
            if p['layer'] not in CONFIG['keepLayers'] or not intersects(p['bbox'],s['planCrop']): continue
            if any(p['layer']==ex['layer'] and contains(ex['bbox'],p['bbox']) for ex in s.get('exclusions',[])): continue
            kept[s['id']]+=1
            fill='#64748b' if p['fill'] and sum(p['fill'])<2.9 else 'none'
            pieces.append(f'<path id="{p["id"]}" data-layer="{html.escape(p["layer"],quote=True)}" d="{svg_d(p["items"])}" fill="{fill}"/>')
        pieces.append('</g></g>')
    pieces.append('</svg>'); (OUT/'master.svg').write_text('\n'.join(pieces)+'\n',encoding='utf-8')
    alignment={**CONFIG,'status':'confirmed','alignmentMethod':'Same-scale translation fitted and verified against six repeated room-label origins in the overlap; PDF rotation explicitly normalized.','rawToDisplay':[0,-1,1,0,0,2384],'anchors':anchors,'maxAnchorResidual':max(a['residual'] for a in anchors),'keptPaths':kept,'sourceHashes':{d['sourceId']:d['sha256'] for d in data},'cleaning':'Explicit CAD layer allowlist. Sheet borders, title blocks, schedules, axes, dimensions, hatches and annotation layers omitted. Seam divides an overlapping identical plan region; paths remain original geometry clipped at the seam.'}
    write_json(OUT/'alignment.json',alignment)
    svgdoc=fitz.open(OUT/'master.svg'); svgdoc[0].get_pixmap(matrix=fitz.Matrix(.65,.65),alpha=False).save(OUT/'inspection/master.png')
    artifacts=[OUT/'master.svg',OUT/'alignment.json',OUT/'source/0001.json',OUT/'source/0002.json',OUT/'source/room-schedule.json',OUT/'inspection/0001.png',OUT/'inspection/0002.png',OUT/'inspection/master.png']
    hashes={str(p.relative_to(OUT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in artifacts}
    write_json(OUT/'manifest.json',{'schemaVersion':1,'generator':'scripts/map-ingest/ingest.py','pymupdfVersion':fitz.VersionBind,'files':hashes})
    print(json.dumps({'viewBox':vb,'keptPaths':kept,'maxAnchorResidual':alignment['maxAnchorResidual'],'hashes':hashes},indent=2))
if __name__=='__main__': main()
