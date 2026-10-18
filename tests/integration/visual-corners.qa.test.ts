import { expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { FloorData, NavigationGraph } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { createRouteSmoother, type CornerDiagnostic } from '../../packages/routing/src/visual-route';
import { createPolylineValidator } from '../../packages/routing/src/geometry-safety';

it.each([
  ['GF', 'G-01', 'G-50'], ['GF', 'G-01', 'G-05'],
  ['01', 'F-01', 'F-50'], ['01', 'F-01', 'F-34'],
])('diagnoses safe corridor rounding: %s %s to %s', (floorId, from, to) => {
  const floor = JSON.parse(readFileSync(`data/buildings/B03/${floorId}.json`, 'utf8')) as FloorData;
  const graph = JSON.parse(readFileSync(`data/buildings/B03/${floorId}.graph.json`, 'utf8')) as NavigationGraph;
  const route = findRoute(graph, floor.rooms.find(r => r.code === from)!.doorNodeId,
    floor.rooms.find(r => r.code === to)!.doorNodeId);
  expect(route.status).toBe('ok');
  let corners: readonly CornerDiagnostic[] = [];
  const visual = createRouteSmoother(graph)(route.points, { onDiagnostics: value => { corners = value; } });
  expect(createPolylineValidator(graph)(visual.points)).toBe(true);
  expect(visual.points[0]).toEqual(route.points[0]);
  expect(visual.points.at(-1)).toEqual(route.points.at(-1));
  expect(corners.some(c => c.applied && c.acceptedRadius > 12)).toBe(true);
  expect(corners.some(c => c.reason === 'safe-simplification')).toBe(true);
  expect(new Set(corners.map(c => c.sourceIndex)).size).toBe(corners.length);
  for (const corner of corners.filter(c => c.protected)) expect(visual.points).toContainEqual(corner.point);
  if (floorId === 'GF' && to === 'G-50') {
    const entranceTurn = corners.find(c => c.point[0] === 2358 && c.point[1] === 1017)!;
    expect(entranceTurn.protected).toBe(false);
    expect(entranceTurn.acceptedRadius).toBeGreaterThanOrEqual(40);
    expect(entranceTurn.rejectedCandidates).toBe(0);
  }
  if (floorId === '01' && to === 'F-34') {
    const constrained = corners.find(c => c.point[0] === 2376 && c.point[1] === 1209)!;
    expect(constrained.rejectedCandidates).toBeGreaterThan(0);
    expect(constrained.acceptedRadius).toBeGreaterThan(30);
    expect(constrained.acceptedRadius).toBeLessThan(constrained.availableRadius);
  }
  if (process.env.QA_CORNER_STAGE) {
    const directory = `artifacts/corner-rounding/${process.env.QA_CORNER_STAGE}`;
    mkdirSync(directory, { recursive: true });
    const detail = corners.map(corner => ({
      ...corner,
      nodes: graph.nodes.filter(n => Math.hypot(n.point[0] - corner.point[0], n.point[1] - corner.point[1]) < 1e-7)
        .map(n => ({ id: n.id, type: n.type, roomId: n.roomId,
          edges: graph.edges.filter(e => e.from === n.id || e.to === n.id).map(e => ({ type: e.pathType, accessibility: e.accessibility })) })),
    }));
    writeFileSync(`${directory}/${floorId}-${from}-${to}.json`, JSON.stringify({ route: route.points, visual, corners: detail }, null, 2));
    console.log(JSON.stringify({ floorId, from, to, corners: corners.length,
      rounded: corners.filter(c => c.applied).length, protected: corners.filter(c => c.protected).length,
      rejected: corners.filter(c => c.rejectedCandidates > 0).length }));
  }
});
