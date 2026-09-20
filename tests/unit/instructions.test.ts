import { describe, expect, it } from 'vitest';
import { findRoute, generateInstructions } from '@wayfinding/routing';
import { syntheticCorner, syntheticEdge, syntheticGraph, syntheticNode } from '../fixtures/routing';

function syntheticAngle(degrees: number) {
  const a = syntheticNode('a', [0, 0]), b = syntheticNode('b', [10, 0]);
  const angle = degrees * Math.PI / 180;
  const c = syntheticNode('c', [10 + 10 * Math.cos(angle), 10 * Math.sin(angle)]);
  return syntheticGraph([a, b, c], [syntheticEdge(a, b), syntheticEdge(b, c)]);
}

describe('synthetic bilingual geometry instructions', () => {
  it.each([
    [0, 'continue'], [14.99, 'continue'], [-14.99, 'continue'], [15, 'slight-right'], [-15, 'slight-left'],
    [44.99, 'slight-right'], [-44.99, 'slight-left'], [45, 'right'], [-45, 'left'], [90, 'right'], [-90, 'left'],
  ])('classifies SVG heading change %s degrees as %s', (angle, type) => {
    const instructions = generateInstructions(syntheticAngle(Number(angle)), ['a', 'b', 'c'], ['a-b', 'b-c']);
    expect(instructions.map(item => item.type)).toEqual(['start', type, 'arrival']);
    for (const item of instructions) { expect(item.text.en).toBeTruthy(); expect(item.text.ar).toMatch(/[\u0600-\u06ff]/); }
  });

  it('uses directed tangents in both directions, with positive y pointing down', () => {
    const graph = syntheticAngle(90);
    expect(generateInstructions(graph, ['a', 'b', 'c'], ['a-b', 'b-c'])[1].text).toEqual({ en: 'Turn right.', ar: 'انعطف يميناً.' });
    expect(generateInstructions(graph, ['c', 'b', 'a'], ['b-c', 'a-b'])[1].text).toEqual({ en: 'Turn left.', ar: 'انعطف يساراً.' });
  });

  it('announces a destination on the correct side, only for a destination door', () => {
    const graph = syntheticCorner();
    expect(findRoute(graph, 'a', 'c').instructions.map(item => item.type)).toEqual(['start', 'destination-right', 'arrival']);
    graph.nodes[2].point = [10, -10];
    graph.edges[1].geometry = [[10, 0], [10, -10]];
    expect(findRoute(graph, 'a', 'c').instructions[1].text.ar).toBe('وجهتك على اليسار.');
    graph.edges[1].pathType = 'corridor';
    expect(findRoute(graph, 'a', 'c').instructions[1].type).toBe('left');
  });

  it('announces entry to a corridor from an entrance', () => {
    const graph = syntheticCorner(); graph.nodes[0].type = 'entrance';
    expect(findRoute(graph, 'a', 'b').instructions.map(item => item.type)).toEqual(['start', 'enter-corridor', 'arrival']);
  });

  it('retains bends within edges and skips duplicate zero-length geometry segments', () => {
    const a = syntheticNode('a', [0, 0]), b = syntheticNode('b', [10, 10]), c = syntheticNode('c', [20, 10]);
    const graph = syntheticGraph([a, b, c], [syntheticEdge(a, b, { geometry: [[0, 0], [10, 0], [10, 0], [10, 10]], distance: 20 }), syntheticEdge(b, c)]);
    expect(findRoute(graph, 'a', 'c').instructions.map(item => item.type)).toEqual(['start', 'right', 'left', 'arrival']);
    expect(findRoute(graph, 'c', 'a').instructions.map(item => item.type)).toEqual(['start', 'right', 'left', 'arrival']);
  });

  it.each(['stairs', 'elevator'] as const)('announces %s and destination floor without inventing a new-floor heading', pathType => {
    const a = syntheticNode('a', [0, 0]), b = syntheticNode('b', [0, 0], { floorId: 'TEST_F1' });
    const c = syntheticNode('c', [10, 0], { floorId: 'TEST_F1' });
    const graph = syntheticGraph([a, b, c], [syntheticEdge(a, b, { pathType, distance: 5 }), syntheticEdge(b, c)]);
    const instructions = findRoute(graph, 'a', 'c').instructions;
    expect(instructions.map(item => item.type)).toEqual(['start', pathType, 'continue', 'arrival']);
    expect(instructions[1].text.en).toContain('TEST_F1');
    expect(instructions[1].text.ar).toContain('TEST_F1');
    expect(findRoute(graph, 'b', 'a').instructions[1].text.en).toContain('TEST_F0');
  });

  it('returns start and arrival for a confirmed same-node route', () => {
    expect(generateInstructions(syntheticCorner(), ['a'], []).map(item => item.type)).toEqual(['start', 'arrival']);
  });

  it('rejects broken, mismatched, reversed one-way, and unconfirmed instruction paths', () => {
    const graph = syntheticCorner();
    expect(generateInstructions(graph, [], [])).toEqual([]);
    expect(generateInstructions(graph, ['a', 'c'], ['a-b'])).toEqual([]);
    expect(generateInstructions(graph, ['a', 'b', 'c'], ['b-c', 'a-b'])).toEqual([]);
    graph.edges[0].bidirectional = false;
    expect(generateInstructions(graph, ['b', 'a'], ['a-b'])).toEqual([]);
    graph.edges[0].status = 'candidate';
    expect(generateInstructions(graph, ['a', 'b'], ['a-b'])).toEqual([]);
    graph.status = 'unknown';
    graph.nodes[2].status = 'unknown';
    expect(generateInstructions(graph, ['c'], [])).toEqual([]);
  });

  it('accepts a fully confirmed path within a partially confirmed graph', () => {
    const graph = syntheticCorner(); graph.status = 'candidate';
    expect(generateInstructions(graph, ['a', 'b'], ['a-b']).map(item => item.type)).toEqual(['start', 'arrival']);
  });

  it('keeps every instruction distance in the route unit without textual fake meters', () => {
    const graph = syntheticAngle(90);
    expect(findRoute(graph, 'a', 'c').instructions.every(item => item.distanceUnit === 'map-unit')).toBe(true);
    graph.calibrationStatus = 'confirmed'; graph.metersPerUnit = 0.5;
    const instructions = findRoute(graph, 'a', 'c').instructions;
    expect(instructions[0]).toMatchObject({ distance: 5, distanceUnit: 'meter' });
    expect(instructions[1]).toMatchObject({ distance: 5, distanceUnit: 'meter' });
  });
});


it('aggregates dense consecutive straight corridor steps while retaining the final corner', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => syntheticNode(String(i), [i, 0]));
  nodes.push(syntheticNode('end', [29, 10]));
  const graph = syntheticGraph(nodes, nodes.slice(1).map((node, i) => syntheticEdge(nodes[i], node)));
  const route = findRoute(graph, '0', 'end');
  expect(route.instructions.map(item => item.type)).toEqual(['start', 'continue', 'right', 'arrival']);
  expect(route.instructions[1].distance).toBe(28);
  expect(route.points).toHaveLength(31);
});
