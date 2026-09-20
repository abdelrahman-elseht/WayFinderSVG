import { describe, expect, it } from 'vitest';
import { findRoute, generateInstructions, polylineLength } from '@wayfinding/routing';
import type { Point } from '@wayfinding/map-engine';
import { syntheticCorner, syntheticEdge, syntheticGraph, syntheticNode } from '../fixtures/routing';

describe('synthetic routing — never live B03 geometry', () => {
  it('preserves the traversed corridor geometry instead of connecting endpoints directly', () => {
    const graph = syntheticCorner();
    const route = findRoute(graph, 'a', 'c');
    expect(route.status).toBe('ok');
    expect(route.nodeIds).toEqual(['a', 'b', 'c']);
    expect(route.points).toEqual([[0, 0], [10, 0], [10, 10]]);
    expect(route.distance).toBe(20);
    expect(route.distanceUnit).toBe('map-unit');
  });

  it('reverses edge geometry and honors one-way links', () => {
    const graph = syntheticCorner();
    expect(findRoute(graph, 'c', 'a').points).toEqual([[10, 10], [10, 0], [0, 0]]);
    graph.edges[1].bidirectional = false;
    expect(findRoute(graph, 'c', 'a').status).toBe('unavailable');
  });

  it('computes polyline length, including empty and coincident points', () => {
    expect(polylineLength([[0, 0], [3, 4], [3, 4], [6, 8]])).toBe(10);
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([[0, 0]])).toBe(0);
    expect(polylineLength([[0, 0], [Infinity, 2]])).toBeNaN();
  });

  it('normalizes mixed weights using only a confirmed scale and selects the true shortest path', () => {
    const graph = syntheticCorner();
    graph.calibrationStatus = 'confirmed';
    graph.metersPerUnit = 0.1;
    graph.edges.push(syntheticEdge(graph.nodes[0], graph.nodes[2], { id: 'metric-shortcut', distance: 3, distanceUnit: 'meter' }));
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'ok', distance: 2, distanceUnit: 'meter', edgeIds: ['a-b', 'b-c'] });
    graph.edges[2].distance = 1;
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ distance: 1, edgeIds: ['metric-shortcut'] });
  });

  it.each(['candidate', 'unknown'] as const)('never treats a %s scale as calibrated', status => {
    const graph = syntheticCorner();
    graph.metersPerUnit = 0.5;
    graph.calibrationStatus = status;
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'ok', distance: 20, distanceUnit: 'map-unit' });
    graph.edges[0].distanceUnit = 'meter';
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'invalid', distanceUnit: 'map-unit' });
  });

  it.each(['candidate', 'unknown'] as const)('allows a confirmed subset of an otherwise %s graph', status => {
    const graph = syntheticCorner();
    graph.status = status;
    expect(findRoute(graph, 'a', 'c').status).toBe('ok');
    graph.edges[0].status = status;
    expect(findRoute(graph, 'a', 'c').status).toBe('unconfirmed');
    graph.nodes = []; graph.edges = [];
    expect(findRoute(graph, 'a', 'c').status).toBe('unconfirmed');
  });

  it.each(['candidate', 'unknown'] as const)('blocks %s nodes and edges', status => {
    const graph = syntheticCorner();
    graph.nodes[0].status = status;
    expect(findRoute(graph, 'a', 'c').status).toBe('unconfirmed');
    graph.nodes[0].status = 'confirmed';
    graph.nodes[1].status = status;
    expect(findRoute(graph, 'a', 'c').status).toBe('unavailable');
    graph.nodes[1].status = 'confirmed';
    graph.edges[0].status = status;
    expect(findRoute(graph, 'a', 'c').status).toBe('unavailable');
  });

  it.each(['closed', 'unknown'] as const)('does not treat %s physical access as open', restriction => {
    const graph = syntheticCorner();
    graph.edges[0].restriction = restriction;
    expect(findRoute(graph, 'a', 'c').status).toBe('unavailable');
  });

  it.each(['unknown', 'inaccessible'] as const)('requires confirmed accessibility, excluding %s', accessibility => {
    const graph = syntheticCorner();
    graph.edges[0].accessibility = accessibility;
    expect(findRoute(graph, 'a', 'c').status).toBe('ok');
    const result = findRoute(graph, 'a', 'c', { accessibleOnly: true });
    expect(result.status).toBe('unavailable');
    expect(result.reason?.en).toContain('step-free');
    expect(result.reason?.ar).toContain('الدرج');
  });

  it('rejects stairs for accessible routes even if an edge is mislabeled accessible', () => {
    const graph = syntheticCorner();
    graph.edges[0].pathType = 'stairs';
    expect(findRoute(graph, 'a', 'c', { accessibleOnly: true }).status).toBe('unavailable');
  });

  it('finds a cheaper multi-floor route with a zero heuristic despite large drawing separation', () => {
    const a = syntheticNode('a', [0, 0]), b = syntheticNode('b', [1000, 0], { floorId: 'TEST_F1' });
    const c = syntheticNode('c', [1, 0]);
    const graph = syntheticGraph([a, b, c], [syntheticEdge(a, c, { distance: 5 }),
      syntheticEdge(a, b, { pathType: 'elevator', distance: 1 }), syntheticEdge(b, c, { pathType: 'elevator', distance: 1 })]);
    expect(findRoute(graph, 'a', 'c', { accessibleOnly: true })).toMatchObject({ status: 'ok', distance: 2, nodeIds: ['a', 'b', 'c'] });
    graph.edges[1].accessibility = 'unknown';
    expect(findRoute(graph, 'a', 'c', { accessibleOnly: true }).nodeIds).toEqual(['a', 'c']);
  });

  it('handles same-node routes and zero-cost cycles', () => {
    const graph = syntheticCorner();
    expect(findRoute(graph, 'a', 'a')).toMatchObject({ status: 'ok', nodeIds: ['a'], edgeIds: [], distance: 0, points: [[0, 0]] });
    graph.edges.forEach(edge => { edge.distance = 0; });
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'ok', distance: 0, nodeIds: ['a', 'b', 'c'] });
  });

  it('returns bilingual explanations for unset kiosk/start, unknown destination, and disconnection', () => {
    const graph = syntheticCorner();
    const unset = findRoute(graph, null, 'c');
    expect(unset).toMatchObject({ status: 'unavailable', points: [], instructions: [] });
    expect(unset.reason?.en).toContain('kiosk');
    expect(unset.reason?.ar).toContain('الكشك');
    expect(findRoute(graph, 'a', null).reason?.ar).toBeTruthy();
    expect(findRoute(graph, 'missing', 'c').status).toBe('invalid');
    graph.edges = [];
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'unavailable', points: [], instructions: [] });
  });

  it.each([-1, NaN, Infinity])('fails safely on malformed weight %s', distance => {
    const graph = syntheticCorner();
    graph.edges[0].distance = distance;
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'invalid', instructions: [] });
  });

  it.each([0, -1, NaN, Infinity, null])('rejects confirmed but invalid calibration %s', scale => {
    const graph = syntheticCorner();
    graph.calibrationStatus = 'confirmed'; graph.metersPerUnit = scale;
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
  });

  it('rejects malformed geometry, duplicate identities, and invalid floor transitions', () => {
    const graph = syntheticCorner();
    graph.edges[0].geometry = [[1, 1], [10, 0]];
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
    graph.edges[0].geometry = [[0, 0], [10, 0]];
    graph.nodes[1].floorId = 'OTHER_TEST_FLOOR';
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
    graph.nodes[1].floorId = 'TEST_F0';
    graph.edges.push(graph.edges[0]);
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
  });
});

describe('synthetic supplied obstacle and enclosure safety', () => {
  const rectangle = (left: number, right: number): Point[] => [[left, -1], [right, -1], [right, 1], [left, 1]];
  function corridor() {
    const a = syntheticNode('a', [0, 0]), b = syntheticNode('b', [10, 0]);
    return syntheticGraph([a, b], [syntheticEdge(a, b)], { navigableAreas: [rectangle(-1, 11)] });
  }

  it.each(([
    [[5, -1], [5, 1]], // Crossing.
    [[5, 0], [5, 1]], // Touching a wall endpoint.
    [[3, 0], [7, 0]], // Collinear overlap.
    [[0, -1], [0, 1]], // Starting directly on a wall.
  ] as [Point, Point][]).map(wall => ({ wall })))('rejects any contact with a supplied wall $wall', ({ wall }) => {
    const graph = corridor(); graph.walls = [wall];
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
    expect(generateInstructions(graph, ['a', 'b'], ['a-b'])).toEqual([]);
  });

  it('accepts a corridor through a modeled wall opening', () => {
    const graph = corridor(); graph.walls = [[[5, -2], [5, -0.5]], [[5, 0.5], [5, 2]]];
    expect(findRoute(graph, 'a', 'b').status).toBe('ok');
  });

  it('checks all polygon-union intervals even when endpoints and the midpoint are inside', () => {
    const graph = corridor(); graph.navigableAreas = [rectangle(-1, 1), rectangle(4, 6), rectangle(9, 11)];
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
    expect(generateInstructions(graph, ['a', 'b'], ['a-b'])).toEqual([]);
  });

  it('accepts contiguous polygon unions and boundary travel without inventing gaps', () => {
    const graph = corridor(); graph.navigableAreas = [rectangle(-1, 5), rectangle(5, 11)];
    expect(findRoute(graph, 'a', 'b').status).toBe('ok');
    graph.navigableAreas = [[[0, 0], [10, 0], [10, 1], [0, 1]]];
    expect(findRoute(graph, 'b', 'a').status).toBe('ok');
  });

  it('rejects a segment exiting a concave enclosure between contained endpoints', () => {
    const graph = corridor();
    graph.navigableAreas = [[[-1, -1], [11, -1], [11, 1], [7, 1], [7, -0.5], [6, -0.5], [6, 1], [-1, 1]]];
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
  });

  it('rejects a same-node route outside the supplied enclosure', () => {
    const graph = corridor(); graph.edges = []; graph.navigableAreas = [rectangle(4, 6)];
    expect(findRoute(graph, 'a', 'a').status).toBe('invalid');
    expect(generateInstructions(graph, ['a'], [])).toEqual([]);
  });

  it('rejects a same-floor edge claiming another floor, including instruction generation', () => {
    const graph = corridor(); graph.edges[0].floorId = 'UNRELATED_TEST_FLOOR';
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
    expect(generateInstructions(graph, ['a', 'b'], ['a-b'])).toEqual([]);
  });

  it('fails closed on unscoped multi-floor constraints and accepts explicit empty constraints', () => {
    const graph = corridor(); graph.nodes[1].floorId = 'TEST_F1'; graph.edges[0].pathType = 'elevator';
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
    expect(generateInstructions(graph, ['a', 'b'], ['a-b'])).toEqual([]);
    graph.navigableAreas = [];
    expect(findRoute(graph, 'a', 'b').status).toBe('ok');
    graph.edges[0].floorId = 'UNRELATED_TEST_FLOOR';
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
  });

  it('rejects malformed supplied enclosures and walls', () => {
    const graph = corridor(); graph.navigableAreas = [[[0, 0], [1, 1], [2, 2]]];
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
    graph.navigableAreas = []; graph.walls = [[[NaN, 0], [1, 1]]];
    expect(findRoute(graph, 'a', 'b').status).toBe('invalid');
  });
});


describe('explicit drawing-based source routing', () => {
  function drawing() {
    const graph = syntheticCorner();
    graph.routingPolicy = 'drawing-based'; graph.status = 'candidate';
    graph.nodes.forEach(node => { node.status = 'candidate'; });
    graph.edges.forEach(edge => { edge.status = 'candidate'; edge.restriction = 'unknown'; edge.accessibility = 'unknown'; });
    graph.navigableAreas = [[[-1, -1], [11, -1], [11, 11], [-1, 11]]];
    return graph;
  }
  it('routes candidate source geometry without changing provenance or inventing scale', () => {
    const graph = drawing(), original = structuredClone(graph);
    expect(findRoute(graph, 'a', 'c')).toMatchObject({ status: 'ok', distance: 20, distanceUnit: 'map-unit' });
    expect(generateInstructions(graph, ['a', 'b', 'c'], ['a-b', 'b-c']).length).toBeGreaterThan(1);
    expect(graph).toEqual(original);
    expect(findRoute(graph, 'a', 'c', { accessibleOnly: true }).status).toBe('unavailable');
    graph.edges.forEach(edge => { edge.accessibility = 'confirmed'; });
    expect(findRoute(graph, 'a', 'c', { accessibleOnly: true }).status).toBe('ok');
  });
  it('invalidates cached geometry and policy when mutable data changes', () => {
    const graph = drawing();
    expect(findRoute(graph, 'a', 'c').status).toBe('ok');
    graph.walls.push([[5, -1], [5, 1]]);
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
    graph.walls = [];
    expect(findRoute(graph, 'a', 'c').status).toBe('ok');
    graph.edges[0].restriction = 'closed';
    expect(findRoute(graph, 'a', 'c').status).toBe('unavailable');
    graph.routingPolicy = 'verified-only';
    expect(findRoute(graph, 'a', 'c').status).toBe('unconfirmed');
  });
  it('rejects missing enclosures, nonfinite source geometry, false weights and unknown policies', () => {
    const graph = drawing(); graph.navigableAreas = [];
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
    const badPoint = drawing(); badPoint.nodes[0].point[0] = Infinity;
    expect(findRoute(badPoint, 'a', 'c').status).toBe('invalid');
    const badWeight = drawing(); badWeight.edges[0].distance = 1;
    expect(findRoute(badWeight, 'a', 'c').status).toBe('invalid');
    const badPolicy = drawing(); Object.assign(badPolicy, { routingPolicy: 'anything-goes' });
    expect(findRoute(badPolicy, 'a', 'c').status).toBe('invalid');
  });
  it('excludes unknown geometry and validates the whole segment through disjoint areas', () => {
    const graph = drawing(); graph.nodes[0].status = 'unknown';
    expect(findRoute(graph, 'a', 'c').status).toBe('unconfirmed');
    graph.nodes[0].status = 'candidate'; graph.edges[0].status = 'unknown';
    expect(findRoute(graph, 'a', 'c').status).toBe('unavailable');
    graph.edges[0].status = 'candidate';
    graph.navigableAreas = [[[-1,-1],[1,-1],[1,1],[-1,1]], [[9,-1],[11,-1],[11,11],[9,11]]];
    expect(findRoute(graph, 'a', 'c').status).toBe('invalid');
  });
});
