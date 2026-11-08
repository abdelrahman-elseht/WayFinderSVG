import { describe, expect, it } from 'vitest';
import { createMapRegistry, validateFloorBundle } from '@wayfinding/map-engine';
import floor from '../../data/buildings/B03/GF.json';
import graph from '../../data/buildings/B03/GF.graph.json';
import content from '../../content/B03/GF.json';
import firstFloor from '../../data/buildings/B03/01.json';
import firstGraph from '../../data/buildings/B03/01.graph.json';
import firstContent from '../../content/B03/01.json';

describe('intentionally unsafe edited runtime graph', () => {
  it('loads the edited geometry through the explicit runtime path while strict validation rejects it', () => {
    const edited = structuredClone(graph);
    const edge = edited.edges[0];
    edge.geometry.splice(1, 0, [700, 600]);
    edge.distance = edge.geometry.slice(1).reduce((sum, p, i) => sum
      + Math.hypot(p[0] - edge.geometry[i][0], p[1] - edge.geometry[i][1]), 0);
    expect(() => validateFloorBundle(floor, edited, content)).toThrow(/navigable areas|intersects a wall/);
    const registry = createMapRegistry([
      { floorData: floor, graph: edited, contents: content, allowUnsafeGeometry: true },
      { floorData: firstFloor, graph: firstGraph, contents: firstContent },
    ]);
    expect(registry.getFloor('B03', 'GF')?.graph).toBe(edited);
  });

  it('still rejects malformed graph references in runtime diagnostic mode', () => {
    const edited = structuredClone(graph);
    edited.edges[0].to = 'missing-node';
    expect(() => validateFloorBundle(floor, edited, content, { allowUnsafeGeometry: true }))
      .toThrow(/existing endpoints/);
  });
});
