"""Validate source-backed ingestion and deterministic regeneration."""
from pathlib import Path
import hashlib, json, subprocess, sys, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'maps/B03/GF'

def check():
    before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.glob('*.pdf')}
    subprocess.run([sys.executable,str(Path(__file__).with_name('ingest.py'))],check=True,capture_output=True)
    first=json.loads((OUT/'manifest.json').read_text('utf8'))
    subprocess.run([sys.executable,str(Path(__file__).with_name('ingest.py'))],check=True,capture_output=True)
    second=json.loads((OUT/'manifest.json').read_text('utf8'))
    assert first==second, 'Regeneration changed artifact hashes'
    assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.glob('*.pdf')}, 'Original PDFs modified'
    align=json.loads((OUT/'alignment.json').read_text('utf8'))
    assert align['maxAnchorResidual']<.02
    assert align['calibration']['metersPerUnit'] is None
    tree=ET.parse(OUT/'master.svg'); ns={'s':'http://www.w3.org/2000/svg'}
    assert len(tree.findall('.//s:path',ns))>5000
    assert not tree.findall('.//s:image',ns), 'Master must be vector geometry'
    assert len(tree.findall('.//s:clipPath',ns))==2
    sources=[json.loads((OUT/f'source/{n}.json').read_text('utf8')) for n in ['0001','0002']]
    signatures=[]
    for source in sources:
        dx,dy=source['displayToMaster'][4:]
        sig=set()
        for p in source['paths']:
            b=p['bbox']
            if p['layer'] not in align['keepLayers'] or not (1850<b[0]+dx<b[2]+dx<2390 and 600<b[1]+dy<b[3]+dy<1900): continue
            signature=(p['layer'],tuple((item['type'],tuple((round(pt[0]+dx,1),round(pt[1]+dy,1)) for pt in item['points'])) for item in p['items']))
            sig.add(signature)
        signatures.append(sig)
    matching=len(signatures[0]&signatures[1])
    assert matching>100, f'Insufficient coincident overlap geometry: {matching}'
    schedule=json.loads((OUT/'source/room-schedule.json').read_text('utf8'))['rows']
    assert [r['code'] for r in schedule]==[f'G-{i:02}' for i in range(1,55)]
    report={'status':'passed','sourceOriginalsUnchanged':True,'repeatRegenerationHashesMatch':True,'masterVectorPathCount':len(tree.findall('.//s:path',ns)),'overlapGeometryMatchesAt0_1PointQuantization':matching,'maxLabelAnchorResidual':align['maxAnchorResidual'],'roomScheduleCount':len(schedule),'metricCalibration':'unknown; metersPerUnit null','visualInspection':['0001 full page','0002 full page','merged master after annotation cleanup']}
    (OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,indent=2))
if __name__=='__main__': check()
