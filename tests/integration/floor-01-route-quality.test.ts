import { expect, it } from 'vitest';
import { validateFloorBundle } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import floor from '../../data/buildings/B03/01.json';
import graph from '../../data/buildings/B03/01.graph.json';
import contents from '../../content/B03/01.json';
import reference from '../../data/buildings/B03/01.shortest-paths.review.json';

it('preserves short corridor alternatives between hearing and intellectual difficulties', () => {
  const bundle = validateFloorBundle(floor, graph, contents);
  for (const code of ['F-20', 'F-21']) {
    const start = bundle.floorData.rooms.find(r => r.code === code)!.doorNodeId!;
    const end = bundle.floorData.rooms.find(r => r.code === 'F-34')!.doorNodeId!;
    const baseline = reference.pairs.find(p => p.start === start && p.end === end || p.end === start && p.start === end)!;
    for (const [a, b] of [[start, end], [end, start]]) {
      const route = findRoute(bundle.graph, a, b);
      expect(route.status).toBe('ok');
      // The source has a continuous southern corridor; no northern-wing detour.
      expect(route.distance).toBeLessThan(1800);
      expect(route.distance, `${code} to F-34 vs source-safe grid ${baseline.distance}`).toBeLessThanOrEqual(baseline.distance * 1.1);
    }
  }
});
