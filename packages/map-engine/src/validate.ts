import type { FloorData, NavigationGraph, Point, RoomContent } from './types';

export interface FloorBundle { floorData: FloorData; graph: NavigationGraph; contents: RoomContent[] }

/** Untrusted JSON enters the application only through this boundary. */
export class DataContractError extends Error {
  constructor(path: string, message: string) { super(`${path}: ${message}`); this.name = 'DataContractError'; }
}
type ObjectValue = Record<string, unknown>;
function fail(path: string, message: string): never { throw new DataContractError(path, message); }
function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path, 'expected object');
  return value as ObjectValue;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return fail(path, 'expected array');
  return value;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) return fail(path, 'expected nonempty string');
  return value;
}
function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, 'expected finite number');
  return value;
}
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') fail(path, 'expected boolean'); }
function choice(value: unknown, options: readonly string[], path: string) {
  if (typeof value !== 'string' || !options.includes(value)) fail(path, `expected ${options.join(' | ')}`);
}
function localized(value: unknown, path: string) { const v = object(value, path); text(v.en, `${path}.en`); text(v.ar, `${path}.ar`); }
function roomAvailability(value: unknown, path: string) {
  const v = object(value, path);
  choice(v.status, ['available', 'unavailable'], `${path}.status`);
  localized(v.reason, `${path}.reason`);
  if (v.configurationId !== undefined) text(v.configurationId, `${path}.configurationId`);
  // Availability is deliberately inline on a Room. A roomId field would make
  // it possible for configuration to point at a different/nonexistent room.
  if (v.roomId !== undefined) fail(`${path}.roomId`, 'availability must be attached to its room record');
}
function nullableText(value: unknown, path: string) { if (value !== null) text(value, path); }
const statuses = ['confirmed', 'candidate', 'unknown'];
function point(value: unknown, path: string): Point {
  const v = array(value, path); if (v.length !== 2) fail(path, 'expected [x, y]');
  return [number(v[0], `${path}[0]`), number(v[1], `${path}[1]`)];
}
const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const same = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
function onSegment(p: Point, a: Point, b: Point): boolean {
  return Math.abs(cross(a, b, p)) <= 1e-6 * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]))
    && p[0] >= Math.min(a[0], b[0]) - 1e-6 && p[0] <= Math.max(a[0], b[0]) + 1e-6
    && p[1] >= Math.min(a[1], b[1]) - 1e-6 && p[1] <= Math.max(a[1], b[1]) + 1e-6;
}
function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  return (cross(a,b,c) * cross(a,b,d) < 0 && cross(c,d,a) * cross(c,d,b) < 0)
    || onSegment(a,c,d) || onSegment(b,c,d) || onSegment(c,a,b) || onSegment(d,a,b);
}
function contains(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i=0; i<polygon.length; i++) {
    const a=polygon[i], b=polygon[(i+1)%polygon.length];
    if (onSegment(p,a,b)) return true;
    if ((a[1]>p[1]) !== (b[1]>p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function polygon(value: unknown, path: string): Point[] {
  const points=array(value,path).map((p,i)=>point(p,`${path}[${i}]`));
  if (points.length>1 && same(points[0],points[points.length-1])) points.pop();
  if (points.length<3) fail(path,'polygon needs at least three distinct points');
  const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length]; return sum+a[0]*b[1]-b[0]*a[1];},0);
  if (!Number.isFinite(area) || Math.abs(area)<1e-7) fail(path,'polygon has no finite area');
  for(let i=0;i<points.length;i++) {
    const next=(i+1)%points.length;
    if(same(points[i],points[next])) fail(path,'polygon has a zero-length segment');
    for(let j=i+1;j<points.length;j++) {
      if(j===next || (j+1)%points.length===i) continue;
      if(intersects(points[i],points[next],points[j],points[(j+1)%points.length])) fail(path,'polygon self-intersects');
    }
  }
  return points;
}
function unique(values: string[], path: string) { if(new Set(values).size!==values.length) fail(path,'duplicate ID'); }
function scale(v: ObjectValue, path: string) {
  choice(v.calibrationStatus,statuses,`${path}.calibrationStatus`);
  if(v.metersPerUnit!==null && number(v.metersPerUnit,`${path}.metersPerUnit`)<=0) fail(path,'scale must be positive');
  if(v.calibrationStatus==='confirmed' && v.metersPerUnit===null) fail(path,'confirmed calibration requires a scale');
  if(v.calibrationStatus!=='confirmed' && v.metersPerUnit!==null) fail(path,'unconfirmed calibration must remain null');
}
function records(value: unknown, path: string): ObjectValue[] {
  const values=array(value,path).map((v,i)=>object(v,`${path}[${i}]`));
  unique(values.map((v,i)=>text(v.id,`${path}[${i}].id`)),path); return values;
}
function safeAsset(value: unknown,path: string) {
  const asset=text(value,path);
  if(!asset.startsWith('/maps/') || asset.includes('..') || asset.includes('\\') || /[?#]/.test(asset) || !asset.endsWith('/master.svg')) fail(path,'expected local /maps/<building>/<floor>/master.svg');
}

/** Validate structure, references, calibration and geometry before narrowing JSON types. */
export function validateFloorBundle(floorInput: unknown, graphInput: unknown, contentInput: unknown): FloorBundle {
  const data=object(floorInput,'floorData'), building=object(data.building,'building'), floor=object(data.floor,'floor');
  if(data.schemaVersion!==1) fail('schemaVersion','expected 1');
  const buildingId=text(building.id,'building.id'), floorId=text(floor.id,'floor.id');
  if(!/^[A-Za-z0-9_-]+$/.test(buildingId) || !/^[A-Za-z0-9_-]+$/.test(floorId)) fail('building/floor.id','IDs must be safe path segments');
  localized(building.name,'building.name'); localized(floor.name,'floor.name');
  const floorIds=array(building.floorIds,'building.floorIds').map((v,i)=>text(v,`building.floorIds[${i}]`)); unique(floorIds,'building.floorIds');
  if(!floorIds.includes(floorId) || floor.buildingId!==buildingId) fail('floor','building/floor association mismatch');
  number(floor.level,'floor.level'); safeAsset(floor.mapAsset,'floor.mapAsset');
  if(floor.mapAsset!==`/maps/${buildingId}/${floorId}/master.svg`) fail('floor.mapAsset','asset must match building and floor');
  const box=array(floor.viewBox,'floor.viewBox').map((v,i)=>number(v,`floor.viewBox[${i}]`));
  if(box.length!==4 || box[2]<=0 || box[3]<=0) fail('floor.viewBox','expected [x,y,positive width,positive height]');
  scale(floor,'floor');
  const inBounds=(p: Point,path: string)=> {if(p[0]<box[0]-1e-3 || p[1]<box[1]-1e-3 || p[0]>box[0]+box[2]+1e-3 || p[1]>box[1]+box[3]+1e-3) fail(path,'point outside floor viewBox');};
  const roomValues=records(data.rooms,'rooms'), kiosks=records(data.kiosks,'kiosks'), contents=records(contentInput,'contents');
  const features=data.mapFeatures===undefined ? [] : records(data.mapFeatures,'mapFeatures');
  features.forEach((f,i)=>{const p=`mapFeatures[${i}]`; if(f.buildingId!==buildingId||f.floorId!==floorId) fail(p,'feature belongs to another building/floor'); localized(f.name,`${p}.name`); choice(f.kind,['escalator','elevator'],`${p}.kind`); polygon(f.polygon,`${p}.polygon`).forEach(v=>inBounds(v,`${p}.polygon`)); choice(f.geometryStatus,statuses,`${p}.geometryStatus`); choice(f.accessibility,statuses,`${p}.accessibility`); const floors=array(f.connectedFloorIds,`${p}.connectedFloorIds`).map((v,j)=>text(v,`${p}.connectedFloorIds[${j}]`)); floors.forEach((id,j)=>{if(!floorIds.includes(id)) fail(`${p}.connectedFloorIds[${j}]`,'unknown floor')}); const ev=array(f.provenance,`${p}.provenance`); if(!ev.length) fail(`${p}.provenance`,'source evidence required'); ev.forEach((v,j)=>{const e=object(v,`${p}.provenance[${j}]`); text(e.source,`${p}.provenance[${j}].source`); text(e.note,`${p}.provenance[${j}].note`); choice(e.status,statuses,`${p}.provenance[${j}].status`); number(e.page,`${p}.provenance[${j}].page`);}); });
  const roomIds=new Set(roomValues.map(v=>v.id));
  const contentIds=new Set(contents.map(v=>v.id));
  if(data.navigationDefaults!==undefined) {
    const defaults=object(data.navigationDefaults,'navigationDefaults');
    if(!roomIds.has(text(defaults.startRoomId,'navigationDefaults.startRoomId'))) fail('navigationDefaults.startRoomId','starting room must exist on this floor');
  }
  unique(roomValues.map((v,i)=>text(v.code,`rooms[${i}].code`)),'rooms.code');
  roomValues.forEach((r,i)=>{
    const p=`rooms[${i}]`;
    if(r.buildingId!==buildingId || r.floorId!==floorId) fail(p,'room belongs to another building/floor');
    localized(r.name,`${p}.name`); choice(r.category,['classroom','office','laboratory','service','restroom','circulation','other'],`${p}.category`);
    const center=point(r.centroid,`${p}.centroid`); inBounds(center,`${p}.centroid`);
    choice(r.geometryStatus,statuses,`${p}.geometryStatus`); nullableText(r.geometryRef,`${p}.geometryRef`); nullableText(r.doorNodeId,`${p}.doorNodeId`);
    if(r.navigationNote!==undefined) localized(r.navigationNote,`${p}.navigationNote`);
    if(r.navigationPartial!==undefined) { bool(r.navigationPartial,`${p}.navigationPartial`); if(r.navigationPartial && !r.navigationNote) fail(p,'partial navigation requires an explanatory bilingual note'); }
    if(r.availability!==undefined) roomAvailability(r.availability,`${p}.availability`);
    if(r.polygon!==null) {
      const poly=polygon(r.polygon,`${p}.polygon`); poly.forEach(v=>inBounds(v,`${p}.polygon`));
      if(!contains(center,poly)) fail(`${p}.centroid`,'source label must lie within its footprint');
      if(r.geometryStatus==='unknown' || r.geometryRef===null) fail(p,'known polygon needs geometry reference and evidence status');
    } else if(r.geometryStatus!=='unknown' || r.geometryRef!==null) fail(p,'missing polygon requires unknown geometry and null reference');
    array(r.aliases,`${p}.aliases`).forEach((v,j)=>text(v,`${p}.aliases[${j}]`)); bool(r.public,`${p}.public`);
    if(!contentIds.has(text(r.contentRef,`${p}.contentRef`))) fail(`${p}.contentRef`,'missing room content');
    const evidence=array(r.provenance,`${p}.provenance`);
    if(!evidence.length) fail(`${p}.provenance`,'source evidence required');
    evidence.forEach((v,j)=> {const e=object(v,`${p}.provenance[${j}]`); text(e.source,`${p}.provenance.source`); text(e.note,`${p}.provenance.note`); choice(e.status,statuses,`${p}.provenance.status`); if(!Number.isInteger(number(e.page,`${p}.provenance.page`)) || (e.page as number)<1) fail(p,'source page must be a positive integer');});
  });
  const usedContent=new Set(roomValues.map(v=>v.contentRef));
  contents.forEach((c,i)=> {const p=`contents[${i}]`; localized(c.description,`${p}.description`); localized(c.imageAlt,`${p}.imageAlt`); bool(c.placeholder,`${p}.placeholder`); nullableText(c.image,`${p}.image`); if(!usedContent.has(c.id)) fail(p,'orphan content');});
  const graph=object(graphInput,'graph'); scale(graph,'graph'); choice(graph.status,statuses,'graph.status');
  if(graph.routingPolicy!==undefined) choice(graph.routingPolicy,['verified-only','drawing-based'],'graph.routingPolicy');
  const drawing=graph.routingPolicy==='drawing-based';
  if(graph.metersPerUnit!==floor.metersPerUnit || graph.calibrationStatus!==floor.calibrationStatus) fail('graph','floor and graph calibration disagree');
  const nodes=records(graph.nodes,'graph.nodes'), edges=records(graph.edges,'graph.edges');
  const nodeMap=new Map(nodes.map(v=>[v.id,v]));
  const areas=array(graph.navigableAreas,'graph.navigableAreas').map((v,i)=>polygon(v,`graph.navigableAreas[${i}]`));
  if(drawing && !areas.length) fail('graph.navigableAreas','drawing-based routing requires source navigable areas');
  areas.forEach((area,i)=>area.forEach(p=>inBounds(p,`graph.navigableAreas[${i}]`)));
  const walls=array(graph.walls,'graph.walls').map((v,i)=>{const w=array(v,`graph.walls[${i}]`); if(w.length!==2) fail('graph.walls','expected two endpoints'); return [point(w[0],`graph.walls[${i}][0]`),point(w[1],`graph.walls[${i}][1]`)] as [Point,Point];});
  nodes.forEach((n,i)=>{
    const p=`graph.nodes[${i}]`; point(n.point,`${p}.point`); choice(n.type,['junction','door','entrance','elevator','stairs','kiosk'],`${p}.type`); choice(n.status,statuses,`${p}.status`);
    if(n.buildingId!==buildingId || !floorIds.includes(text(n.floorId,`${p}.floorId`))) fail(p,'node building/floor is not registered');
    if(n.floorId===floorId) inBounds(n.point as Point,`${p}.point`);
    if(n.roomId!==undefined && !roomIds.has(text(n.roomId,`${p}.roomId`))) fail(p,'node refers to missing room');
    if(n.type==='door' && n.roomId===undefined) fail(p,'door requires a room association');
  });
  roomValues.forEach((r,i)=>{
    if(r.doorNodeId===null) return;
    const n=nodeMap.get(r.doorNodeId);
    const allowedTypes=graph.routingPolicy==='drawing-based' ? ['door','entrance','junction'] : ['door'];
    if(!n || !allowedTypes.includes(n.type as string) || n.roomId!==r.id || n.floorId!==r.floorId) fail(`rooms[${i}].doorNodeId`,'navigation endpoint must refer back to the same room/floor');
    if(n.status==='confirmed' && r.geometryStatus!=='confirmed') fail(`rooms[${i}]`,'confirmed door requires confirmed room geometry');
    if(n.status==='confirmed') {
      const poly=r.polygon as Point[];
      if(!poly.some((a,j)=>onSegment(n.point as Point,a,poly[(j+1)%poly.length]))) fail(`rooms[${i}].doorNodeId`,'confirmed door must intersect its room boundary');
    }
  });
  kiosks.forEach((k,i)=>{
    const p=`kiosks[${i}]`; localized(k.name,`${p}.name`); choice(k.status,statuses,`${p}.status`); nullableText(k.nodeId,`${p}.nodeId`);
    if(k.buildingId!==buildingId || k.floorId!==floorId) fail(p,'kiosk belongs to another building/floor');
    if(k.nodeId!==null) {const n=nodeMap.get(k.nodeId); if(!n || n.floorId!==floorId) fail(p,'missing kiosk node on this floor'); if(k.status==='confirmed' && n.status!=='confirmed') fail(p,'confirmed kiosk requires confirmed node');}
    if(k.status==='confirmed' && k.nodeId===null) fail(p,'confirmed kiosk requires nodeId');
  });
  edges.forEach((e,i)=>{
    const p=`graph.edges[${i}]`; text(e.from,`${p}.from`); text(e.to,`${p}.to`); choice(e.pathType,['corridor','door','entrance','stairs','elevator'],`${p}.pathType`);
    choice(e.distanceUnit,['map-unit','meter'],`${p}.distanceUnit`); choice(e.accessibility,['confirmed','inaccessible','unknown'],`${p}.accessibility`); choice(e.restriction,['open','closed','unknown'],`${p}.restriction`); choice(e.status,statuses,`${p}.status`); bool(e.bidirectional,`${p}.bidirectional`);
    const from=nodeMap.get(e.from), to=nodeMap.get(e.to);
    if(!from || !to || e.from===e.to) fail(p,'edge requires two distinct existing endpoints');
    if(e.floorId!==from.floorId || !floorIds.includes(text(e.floorId,`${p}.floorId`))) fail(p,'edge floor must match its starting node');
    if(from.floorId!==to.floorId && e.pathType!=='stairs' && e.pathType!=='elevator') fail(p,'floor transition requires stairs or elevator');
    const geometry=array(e.geometry,`${p}.geometry`).map((v,j)=>point(v,`${p}.geometry[${j}]`));
    if(geometry.length<2 || !same(geometry[0],from.point as Point) || !same(geometry[geometry.length-1],to.point as Point)) fail(p,'geometry must join the named nodes');
    const length=geometry.slice(1).reduce((sum,v,j)=>sum+Math.hypot(v[0]-geometry[j][0],v[1]-geometry[j][1]),0);
    const distance=number(e.distance,`${p}.distance`);
    if(distance<=0 || !Number.isFinite(length) || length<=0) fail(p,'edge needs positive finite length');
    if(e.distanceUnit==='meter' && graph.calibrationStatus!=='confirmed') fail(p,'metric edge requires confirmed calibration');
    const expected=length*(e.distanceUnit==='meter' ? graph.metersPerUnit as number : 1);
    if(from.floorId===to.floorId && Math.abs(distance-expected)>Math.max(.01,expected*1e-5)) fail(p,'distance disagrees with geometry and calibration');
    if(e.status==='confirmed' || (drawing && e.status==='candidate')) {
      if(e.status==='confirmed' && (from.status!=='confirmed' || to.status!=='confirmed')) fail(p,'confirmed edge needs confirmed nodes');
      if(drawing && (from.status==='unknown' || to.status==='unknown')) fail(p,'drawing-based edge requires known source endpoints');
      if(from.floorId!==to.floorId && (walls.length || areas.length)) fail(p,'v1 constraints lack floor scope for vertical-edge validation');
      if(from.floorId===to.floorId && !areas.length) fail(p,'confirmed floor edge requires verified navigable areas');
      if(areas.length && !geometry.every(v=>areas.some(a=>contains(v,a)))) fail(p,'edge leaves navigable areas');
      for(let j=1;j<geometry.length;j++) {
        const a=geometry[j-1],b=geometry[j];
        if(walls.some(([c,d])=>intersects(a,b,c,d))) fail(p,'routable edge intersects a wall');
        // Split at every enclosure boundary; membership must hold through the whole segment.
        const cuts=[0,1];
        for(const area of areas) for(let k=0;k<area.length;k++) {
          const c=area[k],d=area[(k+1)%area.length],den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);
          if(Math.abs(den)<1e-12 || !intersects(a,b,c,d)) continue;
          cuts.push(((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den);
        }
        cuts.sort((a,b)=>a-b);
        for(let k=1;k<cuts.length;k++) {const t=(cuts[k-1]+cuts[k])/2; if(areas.length && !areas.some(poly=>contains([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],poly))) fail(p,'edge crosses outside navigable areas');}
      }
    }
  });
  if(graph.status==='confirmed' && (nodes.some(n=>n.status!=='confirmed') || edges.some(e=>e.status!=='confirmed'))) fail('graph.status','confirmed graph contains unconfirmed elements');
  // This cast is confined to the boundary after every required field has been checked.
  return {floorData: floorInput as FloorData, graph: graphInput as NavigationGraph, contents: contentInput as RoomContent[]};
}
