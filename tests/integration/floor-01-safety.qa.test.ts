import { describe, expect, it } from 'vitest';
import { findRoute, generateInstructions } from '@wayfinding/routing';
import { replaceSyntheticLine, syntheticDrawingCorridor } from '../fixtures/floor-01-safety';
import type { NavigationGraph } from '@wayfinding/map-engine';

const cases: [string, (graph: NavigationGraph) => void][] = [
  ['wall crossing', g => { g.walls = [[[5, 0], [5, 10]]]; }],
  ['wall contact at endpoint', g => { g.walls = [[[0, 5], [0, 10]]]; }],
  ['tangent wall contact', g => { g.walls = [[[5, 5], [5, 10]]]; }],
  ['collinear wall overlap', g => { g.walls = [[[3, 5], [7, 5]]]; }],
  ['concave union escape', g => { g.navigableAreas = [[[-1, -1], [11, -1], [11, 6], [6, 6], [6, 2], [4, 2], [4, 6], [-1, 6]]]; }],
  ['gap/void shortcut', g => { g.navigableAreas = [[[-1, -1], [4, -1], [4, 11], [-1, 11]], [[6, -1], [11, -1], [11, 11], [6, 11]]]; }],
  ['room solid shortcut', g => { g.navigableAreas = [[[-1, -1], [11, -1], [11, 3], [-1, 3]], [[-1, 7], [11, 7], [11, 11], [-1, 11]], [[-1, 3], [2, 3], [2, 7], [-1, 7]], [[8, 3], [11, 3], [11, 7], [8, 7]]]; }],
  ['envelope escape', g => { replaceSyntheticLine(g, [[0, 5], [5, 15], [10, 5]]); }],
  ['mismatched endpoint', g => { g.edges[0].geometry[0] = [1, 5]; }],
  ['false distance', g => { g.edges[0].distance = 20; }],
  ['mismatched floor', g => { g.edges[0].floorId = 'GF'; }],
  ['missing constraints', g => { g.navigableAreas = []; }],
  ['closed link', g => { g.edges[0].restriction = 'closed'; }],
];

describe('First Floor horizontal contract adversarial fixtures', () => {
  it('accepts a contained candidate route in both directions', () => {
    const g = syntheticDrawingCorridor();
    expect(findRoute(g, 'synthetic-a', 'synthetic-b').status).toBe('ok');
    expect(findRoute(g, 'synthetic-b', 'synthetic-a').status).toBe('ok');
  });
  it.each(cases)('rejects %s without instructions', (_name, mutate) => {
    const g = syntheticDrawingCorridor(); mutate(g);
    expect(findRoute(g, 'synthetic-a', 'synthetic-b').status).not.toBe('ok');
    expect(generateInstructions(g, ['synthetic-a', 'synthetic-b'], ['synthetic-edge'])).toEqual([]);
  });
  it('excludes unassessed accessibility and any cross-floor connection', () => {
    const g = syntheticDrawingCorridor();
    expect(findRoute(g, 'synthetic-a', 'synthetic-b', { accessibleOnly: true }).status).toBe('unavailable');
    g.nodes[1].floorId = 'GF'; g.edges[0].pathType = 'elevator';
    expect(findRoute(g, 'synthetic-a', 'synthetic-b').status).not.toBe('ok');
  });
});
