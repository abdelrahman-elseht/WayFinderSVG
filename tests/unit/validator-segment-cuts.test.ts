import { describe, expect, it } from 'vitest';
import { validateFloorBundle, type FloorData, type NavigationGraph } from '@wayfinding/map-engine';
import floor from '../../data/buildings/B03/01.json';
import graph from '../../data/buildings/B03/01.graph.json';
import contents from '../../content/B03/01.json';
import { replaceSyntheticLine, syntheticDrawingCorridor } from '../fixtures/floor-01-safety';

const syntheticFloor: FloorData = {
  schemaVersion: 1,
  building: { id: 'SYNTHETIC', name: { en: 'Synthetic', ar: 'Synthetic' }, floorIds: ['01'] },
  floor: {
    id: '01', buildingId: 'SYNTHETIC', name: { en: 'Synthetic', ar: 'Synthetic' }, level: 1,
    viewBox: [-20, -20, 80, 80], mapAsset: '/maps/SYNTHETIC/01/master.svg',
    metersPerUnit: null, calibrationStatus: 'unknown',
  },
  rooms: [], kiosks: [],
};

function validateSynthetic(mutate: (g: NavigationGraph) => void) {
  const g = syntheticDrawingCorridor();
  mutate(g);
  return () => validateFloorBundle(syntheticFloor, g, []);
}

describe('validator finite-segment boundary cuts', () => {
  it.each([false, true])('accepts source B03-01-e0005 with the unchanged 925-area union (reverse=%s)', reverse => {
    const sourceEdge = graph.edges.find(candidate => candidate.id === 'B03-01-e0005');
    if (!sourceEdge) throw new Error('Missing canonical regression edge B03-01-e0005');
    const edge = structuredClone(sourceEdge);
    expect(edge.id).toBe('B03-01-e0005');
    expect(edge.geometry).toEqual([[2004, 606], [2004, 630]]);
    expect(edge.distance).toBe(24);
    expect(graph.navigableAreas).toHaveLength(925);
    // Canonical area 477's near endpoint caused t=-0.000460125 before the route start.
    expect(graph.navigableAreas[477]).toEqual([
      [2001.099388, 633.011043], [2004.099388, 606.011043],
      [2003.900612, 605.988957], [2000.900612, 632.988957],
    ]);
    if (reverse) {
      [edge.from, edge.to] = [edge.to, edge.from];
      edge.geometry.reverse();
    }
    // Retain all source constraints and references; isolate only the failing edge.
    expect(() => validateFloorBundle(floor, { ...graph, edges: [edge] }, contents)).not.toThrow();
  });

  it.each<[string, (g: NavigationGraph) => void]>([
    ['shared endpoint between polygons', g => {
      g.navigableAreas = [
        [[-1, 0], [5, 0], [5, 5], [-1, 10]],
        [[5, 5], [11, 0], [11, 10], [5, 10]],
      ];
    }],
    ['collinear navigable boundary', g => {
      g.navigableAreas = [[[0, 5], [10, 5], [10, 10], [0, 10]]];
    }],
    ['boundary-line extension beyond its endpoint', g => {
      g.navigableAreas.push([[4, 5.0000005], [6, 5.0000005], [6, 8], [4, 8]]);
    }],
  ])('accepts a contained synthetic route at %s', (_name, mutate) => {
    expect(validateSynthetic(mutate)).not.toThrow();
  });

  it.each<[string, (g: NavigationGraph) => void, RegExp]>([
    ['concave escape with contained endpoints', g => {
      g.navigableAreas = [[[-1, -1], [11, -1], [11, 6], [6, 6], [6, 2], [4, 2], [4, 6], [-1, 6]]];
    }, /edge crosses outside navigable areas/],
    ['narrow genuine union gap', g => {
      g.navigableAreas = [
        [[-1, 0], [5, 0], [5, 10], [-1, 10]],
        [[5.0001, 0], [11, 0], [11, 10], [5.0001, 10]],
      ];
    }, /edge crosses outside navigable areas/],
    ['escape immediately after the route start', g => {
      g.navigableAreas = [
        [[-1, 0], [0, 0], [0, 10], [-1, 10]],
        [[0.0001, 0], [11, 0], [11, 10], [0.0001, 10]],
      ];
    }, /edge crosses outside navigable areas/],
    ['escape immediately before the route end', g => {
      g.navigableAreas = [
        [[-1, 0], [9.9999, 0], [9.9999, 10], [-1, 10]],
        [[10, 0], [11, 0], [11, 10], [10, 10]],
      ];
    }, /edge crosses outside navigable areas/],
    ['collinear boundary gap', g => {
      g.navigableAreas = [
        [[0, 5], [4, 5], [4, 10], [0, 10]],
        [[6, 5], [10, 5], [10, 10], [6, 10]],
      ];
    }, /edge crosses outside navigable areas/],
    ['exterior geometry endpoint', g => {
      replaceSyntheticLine(g, [[0, 5], [12, 5]]);
    }, /edge leaves navigable areas/],
    ['wall crossing', g => { g.walls = [[[5, 0], [5, 10]]]; }, /intersects a wall/],
    ['wall contact at route start', g => { g.walls = [[[0, 5], [0, 10]]]; }, /intersects a wall/],
    ['wall contact at route end', g => { g.walls = [[[10, 5], [10, 10]]]; }, /intersects a wall/],
    ['tangent wall endpoint', g => { g.walls = [[[5, 5], [5, 10]]]; }, /intersects a wall/],
    ['collinear wall overlap', g => { g.walls = [[[3, 5], [7, 5]]]; }, /intersects a wall/],
  ])('rejects synthetic %s', (_name, mutate, message) => {
    expect(validateSynthetic(mutate)).toThrow(message);
  });
});
