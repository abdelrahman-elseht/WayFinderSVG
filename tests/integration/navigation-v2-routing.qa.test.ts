import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FloorData, NavigationGraph } from '@wayfinding/map-engine';
import { validateFloorBundle } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { createPolylineValidator } from '../../packages/routing/src/geometry-safety';

const floor = JSON.parse(readFileSync('data/buildings/B03/GF.json', 'utf8')) as FloorData;
const legacy = JSON.parse(readFileSync('data/buildings/B03/GF.graph.json', 'utf8')) as NavigationGraph;
const candidate = JSON.parse(readFileSync('artifacts/navigation-v2/GF.v2.graph.diagnostic.json', 'utf8')) as NavigationGraph;
const content = JSON.parse(readFileSync('content/B03/GF.json', 'utf8'));
const validate = createPolylineValidator(candidate);
const cases = [
  ['same-wing-near', 'G-01', 'G-05'], ['same-wing-far', 'G-01', 'G-50'],
  ['cross-wing', 'G-50', 'G-05'], ['previously-disconnected-area', 'G-39', 'G-02'],
  ['shared-approach', 'G-39', 'G-40'], ['qualified-partial', 'G-01', 'G-06'],
  ['northwest-door', 'G-01', 'G-43'], ['east-lobby-door', 'G-01', 'G-16'],
  ['main-lobby-door', 'G-01', 'G-10'], ['west-facade-clearance', 'G-44', 'G-30'],
] as const;

const cross = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0];
function metrics(points: number[][], walls: number[][][]) {
  let turns = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = [points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]];
    const b = [points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]];
    const angle = Math.abs(Math.atan2(cross(a, b), a[0] * b[0] + a[1] * b[1]) * 180 / Math.PI);
    if (angle >= 30) turns++;
  }
  const segmentDistance = (a: number[], b: number[], c: number[], d: number[]) => {
    const pointDistance = (p: number[], x: number[], y: number[]) => {
      const dx = y[0] - x[0], dy = y[1] - x[1], den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, ((p[0] - x[0]) * dx + (p[1] - x[1]) * dy) / den)) : 0;
      return Math.hypot(p[0] - x[0] - t * dx, p[1] - x[1] - t * dy);
    };
    return Math.min(pointDistance(a,c,d), pointDistance(b,c,d), pointDistance(c,a,b), pointDistance(d,a,b));
  };
  let clearance = Infinity;
  for (let i = 1; i < points.length; i++) for (const wall of walls)
    clearance = Math.min(clearance, segmentDistance(points[i - 1], points[i], wall[0], wall[1]));
  return { turns, minimumWallClearance: Number.isFinite(clearance) ? clearance : null };
}

describe('Navigation V2 diagnostic route comparison', () => {
  it('satisfies the existing runtime floor and graph data contract without runtime promotion', () => {
    expect(() => validateFloorBundle(floor, candidate, content)).not.toThrow();
  });

  it('benchmarks identical source endpoints through legacy and V2 with strict route validation', () => {
    const results = cases.map(([id, fromCode, toCode]) => {
    const from = floor.rooms.find(room => room.code === fromCode)!.doorNodeId!;
    const to = floor.rooms.find(room => room.code === toCode)!.doorNodeId!;
    const destination = floor.rooms.find(room => room.code === toCode)!;
    const legacyStarted = performance.now();
    const oldRoute = findRoute(legacy, from, to);
    const legacyMilliseconds = performance.now() - legacyStarted;
    const v2Started = performance.now();
    const newRoute = findRoute(candidate, from, to);
    const v2Milliseconds = performance.now() - v2Started;
    expect(oldRoute.status).toBe('ok');
    if (newRoute.status === 'ok') expect(validate(newRoute.points)).toBe(true);
    expect(newRoute.status).not.toBe('invalid');
    const summarize = (route: typeof oldRoute, graph: NavigationGraph) => ({
      status: route.status, nodeIds: route.nodeIds, edgeIds: route.edgeIds, points: route.points,
      distance: route.distance, distanceUnit: route.distanceUnit,
      ...metrics(route.points, graph.walls), routeSafety: route.status === 'ok' && createPolylineValidator(graph)(route.points),
    });
    return { id, category: id, fromCode, toCode, from, to,
      destinationPartial: destination.navigationPartial ?? false, destinationNote: destination.navigationNote ?? null,
      legacy: { ...summarize(oldRoute, legacy), dijkstraMilliseconds: legacyMilliseconds },
      v2: { ...summarize(newRoute, candidate), dijkstraMilliseconds: v2Milliseconds },
      comparison: newRoute.status === 'ok' && oldRoute.status === 'ok' ? {
        distanceRatio: newRoute.distance / oldRoute.distance,
        turnDifference: metrics(newRoute.points, candidate.walls).turns - metrics(oldRoute.points, legacy.walls).turns,
      } : null };
    });
    mkdirSync('artifacts/navigation-v2', { recursive: true });
    writeFileSync('artifacts/navigation-v2/route-benchmark.json', JSON.stringify({
      methodology: { turnThresholdDegrees: 30, distanceUnit: 'map-unit', clearance: 'minimum Euclidean distance to supplied wall segments; not physical clearance' },
      cases: results,
    }, null, 2) + '\n');
    expect(results.every(result => result.legacy.routeSafety && (result.v2.status !== 'ok' || result.v2.routeSafety))).toBe(true);
  });

  it('keeps shared approach identities and candidate/unknown semantics', () => {
    for (const code of ['G-39', 'G-40']) {
      const room = floor.rooms.find(item => item.code === code)!;
      const node = candidate.nodes.find(item => item.id === room.doorNodeId);
      expect(node?.point).toEqual([926.4935, 1431.457]);
      expect(node?.status).toBe('candidate');
    }
    expect(candidate.nodes.filter(node => node.point[0] === 926.4935 && node.point[1] === 1431.457)).toHaveLength(2);
    expect(candidate.edges.every(edge => edge.status === 'candidate' && edge.restriction === 'unknown'
      && edge.accessibility === 'unknown')).toBe(true);
  });

  it('keeps reviewed door entries and the west-corridor bend in the generated topology', () => {
    const g10 = floor.rooms.find(room => room.code === 'G-10')!.doorNodeId!;
    expect(candidate.edges.some(edge => edge.pathType === 'door'
      && (edge.from === g10 || edge.to === g10)
      && edge.geometry.some(point => point[0] === 2660 && point[1] === 1570))).toBe(true);
    expect(candidate.nodes.some(node => node.point[0] === 2661.436882352941
      && node.point[1] === 1575.7475294117648)).toBe(false);
    expect(candidate.edges.some(edge => edge.geometry.some(point => point[0] === 1340 && point[1] === 1540))).toBe(true);
  });
});
