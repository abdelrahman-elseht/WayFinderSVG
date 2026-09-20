import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const command = process.argv[2] ?? 'validate';
const readJson = filename => JSON.parse(readFileSync(path.join(root, filename), 'utf8'));

// Run the exact shared validator without another runtime dependency or emitted build files.
export async function loadValidator() {
  const filename = path.join(root, 'packages/map-engine/src/validate.ts');
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, fileName: filename,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

export async function validateData({ quiet = false } = {}) {
  const { validateFloorBundle } = await loadValidator();
  const bundles = [];
  const dataRoot = path.join(root, 'data/buildings');
  for (const building of readdirSync(dataRoot, { withFileTypes: true }).filter(v => v.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
    const directory = path.join(dataRoot, building.name);
    for (const filename of readdirSync(directory).filter(v => v.endsWith('.json') && !v.endsWith('.graph.json') && !v.endsWith('.review.json')).sort()) {
      const floorId = filename.slice(0, -5), relative = `data/buildings/${building.name}/${floorId}`;
      const bundle = validateFloorBundle(readJson(`${relative}.json`), readJson(`${relative}.graph.json`), readJson(`content/${building.name}/${floorId}.json`));
      if(bundle.floorData.building.id !== building.name || bundle.floorData.floor.id !== floorId) throw new Error(`${relative}: file path and data IDs disagree`);
      const asset = path.join(root, bundle.floorData.floor.mapAsset.slice(1));
      if(!existsSync(asset)) throw new Error(`Missing canonical map ${asset}; run npm run ingest`);
      const svg = readFileSync(asset, 'utf8');
      const viewBox = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/)?.[1].trim().split(/[\s,]+/).map(Number);
      if(!viewBox || viewBox.length!==4 || viewBox.some((v,i)=>!Number.isFinite(v) || Math.abs(v-bundle.floorData.floor.viewBox[i])>1e-5)) throw new Error(`${relative}: master.svg viewBox does not match floor data`);
      if(/<(?:image|script)\b/i.test(svg)) throw new Error(`${relative}: master.svg must contain source vectors, without embedded images or scripts`);
      bundles.push(bundle);
      if(!quiet) console.log(`Validated ${building.name}/${floorId}: ${bundle.floorData.rooms.length} rooms, ${bundle.graph.nodes.length} nodes, ${bundle.graph.edges.length} edges; graph ${bundle.graph.status}.`);
    }
  }
  if(!bundles.length) throw new Error('No floor data found in data/buildings');
  const keys = new Set(bundles.map(v=>`${v.floorData.building.id}/${v.floorData.floor.id}`));
  const kioskIds = new Set();
  const buildings = new Map();
  for(const bundle of bundles) {
    const { building, kiosks }=bundle.floorData;
    const signature=JSON.stringify({name:building.name,floors:[...building.floorIds].sort()});
    if(buildings.has(building.id) && buildings.get(building.id)!==signature) throw new Error(`Inconsistent building metadata: ${building.id}`);
    buildings.set(building.id,signature);
    for(const floorId of building.floorIds) if(!keys.has(`${building.id}/${floorId}`)) throw new Error(`Missing declared floor: ${building.id}/${floorId}`);
    for(const kiosk of kiosks) {if(kioskIds.has(kiosk.id)) throw new Error(`Duplicate kiosk ID: ${kiosk.id}`); kioskIds.add(kiosk.id);}
  }
  return bundles;
}

let pythonCommand;
function python(script, args = []) {
  if(!pythonCommand) {
    const local = path.join(root, '.venv', process.platform==='win32' ? 'Scripts/python.exe' : 'bin/python');
    const candidates=process.env.PYTHON_EXECUTABLE ? [[process.env.PYTHON_EXECUTABLE]] : [[local],['python3'],['python'],...(process.platform==='win32' ? [['py','-3']] : [])];
    pythonCommand=candidates.find(candidate=>spawnSync(candidate[0],[...candidate.slice(1),'-c','import sys; assert sys.version_info >= (3,10)'],{stdio:'ignore'}).status===0);
    if(!pythonCommand) throw new Error('Python 3.10+ was not found. Install Python, run python -m venv .venv, then install both requirements files. Alternatively set PYTHON_EXECUTABLE to the full Python executable path.');
    const check=spawnSync(pythonCommand[0],[...pythonCommand.slice(1),'-c','import pymupdf, shapely, PIL'],{stdio:'ignore'});
    if(check.status!==0) throw new Error(`Python dependencies missing. Run ${process.platform==='win32' ? '& ' : ''}"${pythonCommand[0]}" ${pythonCommand.slice(1).join(' ')} -m pip install -r scripts/map-ingest/requirements.txt -r scripts/semantic-map/requirements.txt`);
  }
  console.log(`Running ${script}${args.length ? ' '+args.join(' ') : ''}`);
  const result=spawnSync(pythonCommand[0],[...pythonCommand.slice(1),'-X','utf8',path.join(root,script),...args],{cwd:root,stdio:'inherit'});
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`${script} failed (${result.status ?? result.signal})`);
}
function copyAssets(bundles) {
  for(const {floorData} of bundles) {
    const relative=floorData.floor.mapAsset.slice(1);
    const destination=path.join(root,'apps/web/public',relative);
    mkdirSync(path.dirname(destination),{recursive:true});
    copyFileSync(path.join(root,relative),destination);
    console.log(`Prepared /${relative}`);
  }
}
async function main() {
  switch(command) {
    case 'ingest': python('scripts/map-ingest/ingest.py'); break;
    case 'semantic': python('scripts/semantic-map/generate.py'); break;
    case 'review':
      python('scripts/map-ingest/validate.py');
      python('scripts/semantic-map/verify.py',['--regenerate']);
      python('scripts/semantic-map/render_review.py');
      await validateData(); break;
    case 'validate': await validateData(); break;
    case 'prepare': copyAssets(await validateData()); break;
    case 'all':
      python('scripts/map-ingest/ingest.py');
      python('scripts/map-ingest/validate.py');
      python('scripts/semantic-map/generate.py');
      python('scripts/semantic-map/verify.py',['--regenerate']);
      python('scripts/semantic-map/render_review.py');
      copyAssets(await validateData()); break;
    default: throw new Error('Usage: node scripts/integration/pipeline.mjs [ingest|semantic|review|validate|prepare|all]');
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{ console.error(`Integration failed: ${error.message}`); process.exitCode=1; });
}
