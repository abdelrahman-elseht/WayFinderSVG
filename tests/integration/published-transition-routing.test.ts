import { describe, expect, it } from 'vitest';
import type { FloorBundle } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { multiFloorNavigation, routeGraphForTransition } from '../../apps/web/lib/multi-floor-navigation';
import floorGF from '../../data/buildings/B03/GF.json';
import graphGF from '../../data/buildings/B03/GF.graph.json';
import floor01 from '../../data/buildings/B03/01.json';
import graph01 from '../../data/buildings/B03/01.graph.json';

const bundles = [
  { floorData: floorGF, graph: graphGF, contents: [] },
  { floorData: floor01, graph: graph01, contents: [] },
] as unknown as FloorBundle[];
const combinedGraph = multiFloorNavigation(bundles);

const doorNode = (floorId: 'GF' | '01', code: string) => {
  const floor = floorId === 'GF' ? floorGF : floor01;
  return floor.rooms.find(room => room.code === code)?.doorNodeId ?? '';
};

describe('published cross-floor transition choices', () => {
  it.each([
    ['Main Entrance to F-01 by escalator', 'B03-transition-escalator-west', 'GF', 'G-01', '01', 'F-01', 'escalator'],
    ['Main Entrance to F-19 by Lift 5', 'B03-transition-lift-5', 'GF', 'G-01', '01', 'F-19', 'elevator'],
    ['Main Entrance to F-11 by Lift 5', 'B03-transition-lift-5', 'GF', 'G-01', '01', 'F-11', 'elevator'],
    ['Main Entrance to F-11 by escalator', 'B03-transition-escalator-west', 'GF', 'G-01', '01', 'F-11', 'escalator'],
    ['Main Entrance to F-31 by Lift 5', 'B03-transition-lift-5', 'GF', 'G-01', '01', 'F-31', 'elevator'],
    ['Main Entrance to F-31 by escalator', 'B03-transition-escalator-west', 'GF', 'G-01', '01', 'F-31', 'escalator'],
    ['F-01 to G-22 by escalator', 'B03-transition-escalator-west', '01', 'F-01', 'GF', 'G-22', 'escalator'],
    ['F-19 to G-10 by Lift 5', 'B03-transition-lift-5', '01', 'F-19', 'GF', 'G-10', 'elevator'],
  ] as const)('routes %s through the selected landing pair', (_scenario, transitionId, startFloor, startRoom, destinationFloor, destinationRoom, instructionType) => {
    const graph = routeGraphForTransition(combinedGraph, transitionId);
    const route = findRoute(graph, doorNode(startFloor, startRoom), doorNode(destinationFloor, destinationRoom), {
      unsafeGeometry: true,
    });

    expect(route.status).toBe('ok');
    expect(route.instructions.map(instruction => instruction.type)).toContain(instructionType);
  });
});
