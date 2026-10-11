"""Copy a hash-verified evidence pack, preserving its vectors and coordinates.

The adapter has no two-sheet assumption: seamX can be null and its source list
comes from alignment.json. PDFs remain at their immutable source-pack paths.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floor_context import ROOT, read_json, write_json


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_pack(cfg):
    pack = ROOT / cfg['sourcePack']
    manifest = read_json(pack / 'manifest.json')
    for name, expected in manifest['files'].items():
        assert digest(pack / name) == expected, f'Accepted pack drift: {name}'
    align = read_json(pack / 'alignment.json')
    assert align['buildingId'] == cfg['buildingId'] and align['floorId'] == cfg['floorId']
    assert align['viewBox'] == cfg['viewBox'] and align.get('seamX') == cfg.get('seamX')
    assert align['sourceHashes'] == cfg['sourceHashes']
    for source in align['sources']:
        assert digest(pack / 'source/pdfs' / source['file']) == cfg['sourceHashes'][source['id']]
    assert align['calibration']['metersPerUnit'] is None
    schedule = read_json(pack / 'source/room-schedule.json')['rows']
    assert [r['code'] for r in schedule] == [f"{cfg['schedulePrefix']}-{n:02}" for n in range(1, cfg['scheduleCount'] + 1)]
    svg = ET.parse(pack / 'master.svg')
    assert [float(v) for v in svg.getroot().attrib['viewBox'].split()] == cfg['viewBox']
    assert len(svg.findall('.//{http://www.w3.org/2000/svg}path')) == cfg['vectorPathCount']
    assert not svg.findall('.//{http://www.w3.org/2000/svg}image')
    return pack, align, manifest


def ingest(floor_id):
    cfg = read_json(f'scripts/map-ingest/floors/{floor_id}.json')
    pack, align, accepted = check_pack(cfg)
    out = ROOT / cfg['output']
    names = ['master.svg', 'alignment.json', 'validation.json', 'source/room-schedule.json']
    names += [f"source/{s['id']}.json" for s in align['sources']]
    names += [p.relative_to(pack).as_posix() for p in sorted((pack / 'inspection').glob('*.png'))]
    for name in names:
        destination = out / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(pack / name, destination)
    write_json(out / 'manifest.json', dict(schemaVersion=1, buildingId=cfg['buildingId'], floorId=floor_id,
        generator='scripts/map-ingest/pack_adapter.py', sourcePack=cfg['sourcePack'],
        acceptedPackManifestSha256=digest(pack / 'manifest.json'),
        sourceFiles={s['id']: f"{cfg['sourcePack']}/source/pdfs/{s['file']}" for s in align['sources']},
        files={name: digest(out / name) for name in names}))
    print(f'INGESTED {cfg["buildingId"]}/{floor_id}: {len(names)} exact accepted-pack artifacts')


def verify(floor_id):
    cfg = read_json(f'scripts/map-ingest/floors/{floor_id}.json')
    pack, _, accepted = check_pack(cfg)
    # A rebuild runs in the pack's own frame. Compare every manifest entry,
    # including inspection PNGs and unchanged originals, on both runs.
    local = ROOT / '.venv-source-01' / ('Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')
    command = json.loads(os.environ.get('SOURCE_PACK_REBUILD_COMMAND', 'null')) or [str(local) if local.exists() else sys.executable]
    assert isinstance(command, list) and command and all(isinstance(arg, str) and arg for arg in command)
    for _ in range(2):
        with tempfile.TemporaryDirectory(prefix='b03-01-source-') as temporary:
            rebuilt = Path(temporary) / pack.name
            shutil.copytree(pack, rebuilt)
            subprocess.run([*command, '-X', 'utf8', 'scripts/map-ingest/rebuild_pack.py', cfg['rebuildScript'], str(rebuilt)], cwd=ROOT, check=True)
            assert read_json(rebuilt / 'manifest.json') == accepted, 'Source rebuild differs from accepted inventory'
            for name, expected in accepted['files'].items():
                assert digest(rebuilt / name) == expected, f'Source rebuild drift: {name}'
        check_pack(cfg)
    ingest(floor_id)
    first = read_json(cfg['output'] + '/manifest.json')
    ingest(floor_id)
    assert first == read_json(cfg['output'] + '/manifest.json'), 'Runtime source adapter is not deterministic'
    print(f'VERIFIED {cfg["buildingId"]}/{floor_id}: two accepted source rebuilds and two identical adapters')
