import { describe, expect, it } from 'vitest';
import { findRoute, generateInstructions } from '@wayfinding/routing';
import { syntheticEdge, syntheticGraph, syntheticNode } from '../fixtures/routing';

// Deliberately synthetic geometry. These regressions do not verify a live B03 route.
const area: [number, number][][] = [[[-1,-1],[11,-1],[11,11],[-1,11]]];
function corridor() {
  const a = syntheticNode('qa-a', [0, 5]);
  const b = syntheticNode('qa-b', [10, 5]);
  return syntheticGraph([a,b], [syntheticEdge(a,b)], { navigableAreas: area });
}

describe('independent synthetic geometry safety review', () => {
  it('accepts a contained corridor with no obstacle', () => {
    expect(findRoute(corridor(), 'qa-a', 'qa-b').status).toBe('ok');
  });
  it('rejects a confirmed corridor cutting through a supplied wall', () => {
    const graph = corridor();
    graph.walls = [[[5,0],[5,10]]];
    expect(findRoute(graph, 'qa-a', 'qa-b').status).not.toBe('ok');
    expect(generateInstructions(graph, ['qa-a','qa-b'], ['qa-a-qa-b'])).toEqual([]);
  });
  it('rejects a path that exits its supplied navigable enclosure', () => {
    const graph = corridor();
    graph.edges[0].geometry = [[0,5],[0,20],[10,20],[10,5]];
    expect(findRoute(graph, 'qa-a', 'qa-b').status).not.toBe('ok');
  });
  it('rejects an edge falsely claiming a different floor', () => {
    const graph = corridor();
    graph.edges[0].floorId = 'NOT_THE_ENDPOINT_FLOOR';
    expect(findRoute(graph, 'qa-a', 'qa-b').status).not.toBe('ok');
  });
});

// Drawing policy must not bypass computational geometry checks.
describe('independent drawing-policy safety review',()=>{
 const drawing=()=>{const g=corridor();g.routingPolicy='drawing-based' as const;g.status='candidate' as const;g.nodes.forEach(n=>n.status='candidate');g.edges.forEach(e=>{e.status='candidate';e.restriction='unknown';e.accessibility='unknown';});return g;};
 it('allows source candidates with unknown access only when geometry is valid',()=>{
  expect(findRoute(drawing(),'qa-a','qa-b').status).toBe('ok');
  expect(findRoute(drawing(),'qa-a','qa-b',{accessibleOnly:true}).status).not.toBe('ok');
 });
 it('still rejects a wall crossing, a void detour, missing enclosure and closed link',()=>{
  const wall=drawing();wall.walls=[[[5,0],[5,10]]];
  const voidRoute=drawing();voidRoute.edges[0].geometry=[[0,5],[0,20],[10,20],[10,5]];voidRoute.edges[0].distance=40;
  const empty=drawing();empty.navigableAreas=[];
  const closed=drawing();closed.edges[0].restriction='closed';
  for(const g of [wall,voidRoute,empty,closed])expect(findRoute(g,'qa-a','qa-b').status).not.toBe('ok');
 });
});
