import assert from 'node:assert/strict';
import { loadValidator, validateData } from './pipeline.mjs';

const { validateFloorBundle, DataContractError }=await loadValidator();
const [canonical]=await validateData({quiet:true});
const cases=[
  ['unknown routing policy',b=>b.graph.routingPolicy='anything-goes'],
  ['missing default starting room',b=>b.floorData.navigationDefaults={startRoomId:'missing'}],
  ['drawing mode needs enclosures',b=>{b.graph.routingPolicy='drawing-based';b.graph.navigableAreas=[];}],
  ['missing localized name',b=>delete b.floorData.rooms[0].name.ar],
  ['missing required field',b=>delete b.floorData.rooms[0].aliases],
  ['nonfinite coordinate',b=>b.floorData.rooms[0].centroid[0]=Infinity],
  ['wrong building',b=>b.floorData.rooms[0].buildingId='UNKNOWN'],
  ['duplicate room ID',b=>b.floorData.rooms[1].id=b.floorData.rooms[0].id],
  ['dangling content',b=>b.floorData.rooms[0].contentRef='missing'],
  ['malformed content',b=>b.contents[0].placeholder='yes'],
  ['invented calibration',b=>b.floorData.floor.metersPerUnit=1],
  ['missing kiosk node',b=>{b.floorData.kiosks[0].status='confirmed';}],
  ['unsafe map path',b=>b.floorData.floor.mapAsset='/maps/../../master.svg'],
  ['malformed wall',b=>b.graph.walls[0]=[[1,2]]],
  ['degenerate polygon',b=>b.floorData.rooms[0].polygon=[[1,1],[2,2],[3,3]]],
  ['dangling door',b=>b.floorData.rooms[0].doorNodeId='missing'],
];
if(canonical.graph.edges.length) cases.push(
  ['dangling endpoint',b=>b.graph.edges[0].from='missing'],
  ['geometry disconnect',b=>b.graph.edges[0].geometry[0]=[0,0]],
  ['false edge length',b=>b.graph.edges[0].distance+=100],
  ['unverified metric unit',b=>b.graph.edges[0].distanceUnit='meter'],
  ['false edge confirmation',b=>b.graph.edges[0].status='confirmed'],
);
for(const [name,mutate] of cases) {
  const bundle=structuredClone(canonical); mutate(bundle);
  assert.throws(()=>validateFloorBundle(bundle.floorData,bundle.graph,bundle.contents),DataContractError,name);
}
console.log(`Data contract rejection checks passed: ${cases.length}; canonical source bundle accepted.`);
