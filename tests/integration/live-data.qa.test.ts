import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import type { FloorData, NavigationGraph } from '@wayfinding/map-engine';
import { searchRooms } from '@wayfinding/search';
import { findRoute } from '@wayfinding/routing';
const floor = JSON.parse(readFileSync('data/buildings/B03/GF.json', 'utf8')) as FloorData;
const graph = JSON.parse(readFileSync('data/buildings/B03/GF.graph.json', 'utf8')) as NavigationGraph;
const room = (code:string) => floor.rooms.find(r=>r.code===code)!;
describe('independent live B03 data/service integration', () => {
 it('ranks every exact schedule code and finds Arabic and typo names', () => {
  for(const r of floor.rooms) {
   expect(searchRooms(floor.rooms,r.code)[0]?.id).toBe(r.id);
   expect(searchRooms(floor.rooms,r.code.replace('-',''))[0]?.id).toBe(r.id);
   expect(searchRooms(floor.rooms,r.name.ar,'ar')).toContain(r);
  }
  expect(searchRooms(floor.rooms,'الْعِيَادَة','ar')[0]?.code).toBe('G-28');
  expect(searchRooms(floor.rooms,'clinc','en')[0]?.code).toBe('G-28');
 });
 it('keeps null physical kiosk distinct from the named planning default', () => {
  expect(floor.kiosks[0].nodeId).toBeNull();
  expect(floor.navigationDefaults?.startRoomId).toBe(room('G-01').id);
  expect(findRoute(graph,null,room('G-28').doorNodeId)).toMatchObject({status:'unavailable',points:[],instructions:[]});
 });
 it('routes actual entrance to clinic and cross-wing rooms using candidate drawing evidence',()=>{
  expect(graph.routingPolicy).toBe('drawing-based');
  expect(graph.navigableAreas.length).toBeGreaterThan(0);
  expect(graph.metersPerUnit).toBeNull();
  expect(graph.nodes.every(n=>n.status==='candidate')).toBe(true);
  for(const [a,b] of [['G-01','G-28'],['G-45','G-05'],['G-54','G-02']]) {
   const route=findRoute(graph,room(a).doorNodeId,room(b).doorNodeId);
   expect(route.status,`${a} → ${b}`).toBe('ok');
   expect(route.points.length).toBeGreaterThan(1);
   expect(route.instructions.length).toBeGreaterThan(1);
   expect(route.distanceUnit).toBe('map-unit');
   expect(route.points[0]).toEqual(graph.nodes.find(n=>n.id===room(a).doorNodeId)?.point);
   expect(route.points.at(-1)).toEqual(graph.nodes.find(n=>n.id===room(b).doorNodeId)?.point);
  }
 });
 it('preserves verified-only and accessibility rejection on an explicit copy of live drawing data',()=>{
  const strict=structuredClone(graph); delete strict.routingPolicy;
  expect(findRoute(strict,room('G-45').doorNodeId,room('G-46').doorNodeId).status).not.toBe('ok');
  expect(findRoute(graph,room('G-45').doorNodeId,room('G-46').doorNodeId,{accessibleOnly:true}).status).not.toBe('ok');
 });
 it('connects every ordered pair of 54 actual approach endpoints',()=>{
  const failures:unknown[]=[]; const started=Date.now();let pairs=0;
  for(const a of floor.rooms) for(const b of floor.rooms) {
   const result=findRoute(graph,a.doorNodeId,b.doorNodeId);pairs++;
   if(result.status!=='ok') failures.push({from:a.code,to:b.code,status:result.status,reason:result.reason});
  }
  writeFileSync('artifacts/qa/r2-all-pairs.json',JSON.stringify({pairs,elapsedMs:Date.now()-started,failures,scope:'Source drawing approach endpoints; does not certify physical access or exact room-door arrival'},null,2));
  expect(pairs).toBe(2916);expect(failures.length,JSON.stringify(failures.slice(0,5))).toBe(0);
 },120000);
});


