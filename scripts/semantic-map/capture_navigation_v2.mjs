import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Diagnostic renderer only. The production app and its graph import are untouched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'artifacts/navigation-v2/screenshots');
const arg = (name, fallback) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const port = Number(arg('port', '4767'));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sourcePath = 'maps/B03/GF/master.svg';
const legacyPath = 'data/buildings/B03/GF.graph.json';
const v2Path = 'artifacts/navigation-v2/GF.v2.graph.diagnostic.json';
const routePath = arg('routes', 'artifacts/navigation-v2/route-benchmark.json');
const unresolvedPath = arg('unresolved', 'artifacts/navigation-v2/unresolved-approaches.json');
const source = read(sourcePath);
const legacy = json(legacyPath);
const v2 = json(v2Path);
const benchmark = fs.existsSync(path.join(root, routePath)) ? json(routePath) : {};
const unresolved = fs.existsSync(path.join(root, unresolvedPath)) ? json(unresolvedPath) : {};
const sourceViewBox = source.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const sourceBody = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const escape = value => String(value).replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const polyline = (points, color, width, extra = '') => points?.length > 1 ? `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>` : '';
function graphOverlay(graph, color) {
  return graph.edges.map(edge => polyline(edge.geometry, color, 2.3, 'opacity=".76"')).join('') + graph.nodes.map(node => `<circle cx="${node.point[0]}" cy="${node.point[1]}" r="${node.type === 'junction' ? 2.8 : 4.2}" fill="${node.type === 'junction' ? color : '#fff'}" stroke="${color}" stroke-width="1.2"><title>${escape(node.id)}</title></circle>`).join('');
}
function panel(title, graph, color, viewBox = sourceViewBox, route, markers = []) {
  const points = route?.points ?? route?.geometry ?? route?.polyline;
  const markerHtml = markers.map(marker => `<circle cx="${marker.point[0]}" cy="${marker.point[1]}" r="7" fill="#fff" stroke="#d21931" stroke-width="2"><title>${escape(marker.id ?? '')}: [${marker.point.join(', ')}]</title></circle>`).join('');
  const endpoints = points?.length ? [points[0], points.at(-1)].map((p,index) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="${index ? '#d21931' : '#18723d'}" stroke="white" stroke-width="2"/><text x="${p[0]}" y="${p[1]+3}" text-anchor="middle" fill="white" font-size="9" font-family="Arial">${index ? 'D' : 'O'}</text>`).join('') : '';
  return `<section><h2>${escape(title)}</h2><div class="panel-meta">${graph.nodes.length} nodes · ${graph.edges.length} edges${route ? ' · route status: '+escape(route.status ?? 'unspecified') : ''}</div><svg viewBox="${viewBox.join(' ')}" role="img" aria-label="${escape(title)}"><g opacity=".67">${sourceBody}</g>${graphOverlay(graph,color)}${polyline(points, '#fff', 9)}${polyline(points, '#d21931', 5)}${endpoints}${markerHtml}</svg></section>`;
}
const cases = benchmark.cases ?? benchmark.routes ?? [];
const diagnosticsPath = 'artifacts/navigation-v2/connectivity-diagnostics.json';
const diagnostics = fs.existsSync(path.join(root, diagnosticsPath)) ? json(diagnosticsPath) : {};
const unresolvedRecords = Array.isArray(unresolved) ? unresolved : unresolved.unresolvedApproaches ?? unresolved.unresolved ?? [];
const views = [
  {id:'full-floor-legacy', title:'Ground Floor — canonical legacy graph', kind:'legacy', width:3400,height:1900},
  {id:'full-floor-v2', title:'Ground Floor — V2 diagnostic candidate graph', kind:'v2',width:3400,height:1900},
  {id:'side-by-side', title:'Legacy / V2 — identical source projection, extent and scale',kind:'comparison',width:4200,height:1500},
  ...cases.map(item => ({id:`route-${item.id}`,title:`${item.id} — ${item.from ?? item.fromRoomId ?? ''} → ${item.to ?? item.toRoomId ?? ''}`,kind:'route',item,width:4200,height:1500})),
];
const grouped = new Map();
for (const record of unresolvedRecords) {
  const point = record.point ?? record.coordinate;
  if (!point) continue;
  const key = point.join(',');
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push({...record, point, id:record.id ?? record.room ?? record.roomId});
}
let detailIndex = 0;
for (const records of grouped.values()) {
  detailIndex += 1;
  const point = records[0].point;
  views.push({id:`unresolved-${String(detailIndex).padStart(3,'0')}`,title:`Unresolved ${records.map(record=>record.id).join(' / ')} — [${point.join(', ')}]`,kind:'detail',records,viewBox:[point[0]-110,point[1]-90,220,180],width:2600,height:1500});
}
for (const gap of diagnostics.gaps ?? []) {
  const coordinates = gap.coordinates?.length ? gap.coordinates : [gap.endpointA,gap.endpointB].filter(Boolean);
  if (!coordinates.length) continue;
  const xs=coordinates.map(p=>p[0]), ys=coordinates.map(p=>p[1]);
  const minX=Math.min(...xs), minY=Math.min(...ys);
  const width=Math.max(180,Math.max(...xs)-minX+80), height=Math.max(150,Math.max(...ys)-minY+80);
  views.push({id:`gap-${gap.id}`,title:`${gap.id} — ${gap.classification ?? 'source gap'}`,kind:'detail',records:coordinates.map((point,index)=>({point,id:`${gap.id}:${index+1}`,gap})),viewBox:[minX-40,minY-40,width,height],width:2600,height:1500});
}
const rejectedCandidates=(diagnostics.candidates??[]).filter(item=>item.decision==='not-authorized'||String(item.validation).startsWith('rejected'));
for (const candidate of rejectedCandidates) {
  const coordinates=[candidate.endpointA,candidate.endpointB].filter(Boolean);
  if (!coordinates.length) continue;
  const xs=coordinates.map(p=>p[0]), ys=coordinates.map(p=>p[1]);
  const minX=Math.min(...xs), minY=Math.min(...ys);
  const width=Math.max(100,Math.max(...xs)-minX+55), height=Math.max(85,Math.max(...ys)-minY+45);
  views.push({id:`junction-${candidate.id}`,title:`Rejected ${candidate.id} — ${candidate.classification ?? candidate.validation}`,kind:'detail',records:coordinates.map((point,index)=>({point,id:`${candidate.id}:${index+1}`,gap:candidate})),viewBox:[minX-25,minY-20,width,height],width:1800,height:1100});
}
function page(view) {
  let panels;
  if (view.kind === 'legacy') panels = panel('Legacy · canonical runtime graph',legacy,'#057a84');
  else if (view.kind === 'v2') panels = panel('V2 · diagnostic candidate · not runtime',v2,'#aa1f86');
  else if (view.kind === 'detail') panels = panel('Legacy context',legacy,'#057a84',view.viewBox,null,view.records)+panel('V2 unresolved source connection',v2,'#aa1f86',view.viewBox,null,view.records);
  else panels = panel('Legacy · canonical runtime graph',legacy,'#057a84',sourceViewBox,view.item?.legacy)+panel('V2 · diagnostic candidate · not runtime',v2,'#aa1f86',sourceViewBox,view.item?.v2);
  const reason = view.records?.map(record=>`${record.id}: ${record.gap?.classification ?? record.reason ?? 'unresolved'}${record.gap?.distance != null ? `, gap ${record.gap.distance} drawing units` : ''}`).join(' · ') ?? '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(view.title)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#f6f4ef;color:#14202b;font-family:Arial,sans-serif}body{height:100vh;padding:32px 36px;display:flex;flex-direction:column}header{display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #c9c7bf;padding-bottom:20px;gap:40px}h1{font-size:30px;margin:0 0 9px}p{font-size:19px;margin:0;color:#44525a}.tag{max-width:650px;font-size:18px;line-height:1.5;text-align:right;color:#76435f}main{flex:1;min-height:0;display:flex;gap:28px;padding:24px 0}section{min-width:0;flex:1;background:white;border:1px solid #c4c9cb;border-radius:8px;padding:20px;display:flex;flex-direction:column}h2{font-size:24px;margin:0 0 8px}.panel-meta{font-size:18px;color:#53616a;margin-bottom:12px}svg{width:100%;flex:1;min-height:0;overflow:hidden;background:#fff}footer{font-size:17px;color:#52616b;line-height:1.5;border-top:1px solid #c9c7bf;padding-top:14px}.colors{white-space:nowrap;color:#057a84}.v2{color:#aa1f86}</style><body><header><div><h1>${escape(view.title)}</h1><p>B03 / GF · original source architecture + exact graph polylines · drawing units only</p></div><div class="tag">DIAGNOSTIC REVIEW<br>Candidate status, unknown access and partial endpoints remain unchanged.</div></header><main>${panels}</main><footer><span class="colors">● Legacy: teal</span> &nbsp; <span class="v2">● V2: magenta</span> &nbsp; ● White centers: approach / decision endpoints · Red: compared route or unresolved marker<br>${escape(reason)}<br>Source ${sourcePath} · viewBox ${view.kind==='detail'?view.viewBox.join(' '):sourceViewBox.join(' ')} · equal source projection and panel extent · no physical scale or accessibility claim</footer></body></html>`;
}
fs.mkdirSync(directory,{recursive:true});
const server = http.createServer((request,response) => {
  const url = new URL(request.url,'http://localhost');
  const view = views.find(item => item.id === url.searchParams.get('view')) ?? views[0];
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  response.end(page(view));
});
await new Promise(resolve => server.listen(port,'127.0.0.1',resolve));
if (process.argv.includes('--serve')) { console.log(`Review server: http://127.0.0.1:${port}/?view=side-by-side`); }
else {
  const browser = await chromium.launch({headless:true});
  try {
    const metadata = {schemaVersion:1, purpose:'Diagnostic review only; canonical runtime unchanged', browser:browser.version(), engine:'Playwright Chromium', capturedAt:new Date().toISOString(), captureCommand:`node scripts/semantic-map/capture_navigation_v2.mjs --routes=${routePath} --unresolved=${unresolvedPath}`, sourceFiles:Object.fromEntries([sourcePath,legacyPath,v2Path,routePath,unresolvedPath,diagnosticsPath,'scripts/semantic-map/capture_navigation_v2.mjs'].filter(file=>fs.existsSync(path.join(root,file))).map(file=>[file,{sha256:hash(fs.readFileSync(path.join(root,file)))}])),images:[]};
    for (const view of views) {
      const url = `http://127.0.0.1:${port}/?view=${view.id}`;
      const browserPage = await browser.newPage({viewport:{width:view.width,height:view.height},deviceScaleFactor:1,reducedMotion:'reduce'});
      await browserPage.goto(url,{waitUntil:'networkidle'});
      await browserPage.evaluate(()=>document.fonts.ready);
      const filename = `${view.id}.png`;
      await browserPage.screenshot({path:path.join(directory,filename)});
      const image = {id:view.id,file:filename,title:view.title,url,viewport:{width:view.width,height:view.height},sha256:hash(fs.readFileSync(path.join(directory,filename))),sourceViewBox:view.viewBox??sourceViewBox,caseId:view.item?.id,routeStatuses:view.item?{legacy:view.item.legacy?.status,v2:view.item.v2?.status}:undefined,unresolved:view.records,diagnosticGap:view.records?.[0]?.gap};
      metadata.images.push(image);
      console.log(`${filename} ${view.width}x${view.height} ${image.sha256}`);
      await browserPage.close();
    }
    metadata.diagnosticCounts={gaps:diagnostics.gaps?.length??0,candidates:diagnostics.candidates?.length??0,candidateDecisions:Object.fromEntries(Object.entries(Object.groupBy(diagnostics.candidates??[],item=>item.decision??'unclassified')).map(([key,items])=>[key,items.length])),capturedGapIds:views.filter(view=>view.id.startsWith('gap-')).map(view=>view.id.slice(4)),capturedRejectedCandidateIds:views.filter(view=>view.id.startsWith('junction-')).map(view=>view.id.slice(9))};
    fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify(metadata,null,2)+'\n');
    fs.writeFileSync(path.join(directory,'index.md'),`# Navigation V2 review captures\n\nDiagnostic only. The index covers ${metadata.diagnosticCounts.gaps} excluded spine gaps and ${metadata.diagnosticCounts.candidates} candidate junctions. It includes source and graph SHA-256 hashes, browser, viewport, URLs, command, route case IDs/statuses and unresolved coordinates in [index.json](index.json).\n\n${metadata.images.map(item=>`- [${item.id}](${item.file}): ${item.title}${item.routeStatuses?` (legacy ${item.routeStatuses.legacy}, V2 ${item.routeStatuses.v2})`:''}`).join('\n')}\n`);
  } finally { await browser.close(); server.close(); }
}
