import { describe, expect, it } from 'vitest';
import type { NavigationGraph } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { createRouteSmoother } from '../../packages/routing/src/visual-route';
import { createPolylineValidator } from '../../packages/routing/src/geometry-safety';
import ground from '../../data/buildings/B03/GF.graph.json';
import first from '../../data/buildings/B03/01.graph.json';

describe.each([['GF', ground], ['01', first]] as const)('%s real floor visual routes', (_, data) => {
  it('keeps all reachable endpoint routes safe without changing navigation data', () => {
    const graph = data as NavigationGraph;
    const before = JSON.stringify(graph);
    const smooth = createRouteSmoother(graph);
    const safe = createPolylineValidator(graph);
    const endpoints = graph.nodes.filter(node => node.type !== 'junction');
    let tested = 0, changed = 0, rounded = 0;
    for (const destination of endpoints) {
      const route = findRoute(graph, endpoints[0].id, destination.id);
      if (route.status !== 'ok') continue;
      const original = JSON.stringify(route);
      const visual = smooth(route.points);
      expect(safe(visual.points), destination.id).toBe(true);
      expect(visual.points[0]).toEqual(route.points[0]);
      expect(visual.points.at(-1)).toEqual(route.points.at(-1));
      expect(JSON.stringify(route)).toBe(original);
      if (JSON.stringify(visual.points) !== JSON.stringify(route.points)) changed++;
      if (visual.points.some(point => !route.points.some(original => point[0] === original[0] && point[1] === original[1]))) rounded++;
      tested++;
    }
    expect(tested).toBeGreaterThan(5);
    expect(changed).toBeGreaterThan(0);
    expect(rounded).toBeGreaterThan(0);
    expect(JSON.stringify(graph)).toBe(before);
  }, 60000);
});
