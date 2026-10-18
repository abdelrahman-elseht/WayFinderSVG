import { describe, expect, it } from 'vitest';
import type { Point } from '@wayfinding/map-engine';
import { createRouteSmoother, type CornerDiagnostic } from '../../packages/routing/src/visual-route';
import { safePolyline } from '../../packages/routing/src/geometry-safety';
import { clipVisualRouteAtProgress } from '../../apps/web/components/routePlayback';
import { syntheticEdge, syntheticGraph, syntheticNode } from '../fixtures/routing';

const area: Point[][] = [[[-100, -100], [100, -100], [100, 100], [-100, 100]]];
const graph = () => syntheticGraph([], [], { navigableAreas: area });
const corner: Point[] = [[0, 0], [20, 0], [20, 20]];

describe('safe visual route smoothing', () => {
  it.each([
    ['45 degrees', [[0, 0], [20, 0], [40, 20]]],
    ['90 degrees', corner],
    ['consecutive turns', [[0, 0], [20, 0], [20, 20], [40, 20], [40, 40]]],
    ['short segments', [[0, 0], [2, 0], [2, 2]]],
  ] as [string, Point[]][])('rounds %s without overshoot or source mutation', (_, points) => {
    const before = structuredClone(points);
    const output = createRouteSmoother(graph())(points);
    expect(output.points.length).toBeGreaterThan(points.length);
    expect(output.points[0]).toEqual(points[0]);
    expect(output.points.at(-1)).toEqual(points.at(-1));
    expect(points).toEqual(before);
    expect(safePolyline(output.points, graph())).toBe(true);
    for (const p of output.points) {
      expect(p[0]).toBeGreaterThanOrEqual(0);
      expect(p[1]).toBeGreaterThanOrEqual(0);
      expect(p[0]).toBeLessThanOrEqual(Math.max(...points.map(p => p[0])));
      expect(p[1]).toBeLessThanOrEqual(Math.max(...points.map(p => p[1])));
    }
    output.sourceDistances.forEach((s, i) => {
      expect(Number.isFinite(s)).toBe(true);
      if (i) expect(s).toBeGreaterThan(output.sourceDistances[i - 1]);
    });
  });

  it('keeps straight lines and safely removes collinear/duplicate vertices', () => {
    const smooth = createRouteSmoother(graph());
    expect(smooth([[0, 0], [5, 0], [5, 0], [10, 0]]).points).toEqual([[0, 0], [10, 0]]);
    expect(smooth([[0, 0], [5, 0.001], [10, 0]]).points).toEqual([[0, 0], [10, 0]]);
    expect(smooth([]).points).toEqual([]);
    expect(smooth([[1, 2]]).points).toEqual([[1, 2]]);
    expect(smooth([[1, 2], [1, 2], [1, 2]]).points).toEqual([[1, 2]]);
  });

  it.each([
    [[0, 0], [20, 0], [0, 0]],
    [[0, 0], [20, 0], [0, 0.1]],
    [[0, 0], [0.01, 0], [0.01, 0.01]],
  ] as Point[][])('preserves reversals and subminimum corners %#', (...points) => {
    expect(createRouteSmoother(graph())(points).points).toEqual(points);
  });

  it('shrinks corners in a narrow L corridor and validates every chord', () => {
    const g = graph();
    g.navigableAreas = [
      [[-1, -0.3], [20.3, -0.3], [20.3, 0.3], [-1, 0.3]],
      [[19.7, -0.3], [20.3, -0.3], [20.3, 21], [19.7, 21]],
    ];
    const output = createRouteSmoother(g)(corner);
    expect(output.points.length).toBeGreaterThan(3);
    expect(output.points[1][0]).toBeGreaterThan(18);
    expect(safePolyline(output.points, g)).toBe(true);
  });

  it('reduces radius near a wall and retains an unroundable corner', () => {
    const g = graph();
    g.walls = [[[18, 0.1], [18, 10]]];
    const output = createRouteSmoother(g)(corner);
    expect(output.points.length).toBeGreaterThan(3);
    expect(output.points[1][0]).toBeGreaterThan(13);
    expect(safePolyline(output.points, g)).toBe(true);
    g.navigableAreas = [
      [[-1, -1], [20, -1], [20, 0], [-1, 0]],
      [[20, 0], [21, 0], [21, 21], [20, 21]],
    ];
    expect(createRouteSmoother(g)(corner).points).toEqual(corner);
  });

  it('rejects an unsafe near-collinear shortcut over a tiny wall', () => {
    const g = graph();
    g.walls = [[[5, -0.001], [5, 0.001]]];
    const points: Point[] = [[0, 0], [5, 0.01], [10, 0]];
    expect(createRouteSmoother(g)(points).points).toEqual(points);
  });

  it('preserves critical anchors and transition geometry but rounds corridor branches', () => {
    const smooth = createRouteSmoother(graph());
    expect(smooth(corner, { protectedIndices: [1] }).points).toEqual(corner);
    const nodes = corner.map((p, i) => syntheticNode(String(i), p));
    nodes[1].type = 'door';
    expect(createRouteSmoother(syntheticGraph(nodes, [], { navigableAreas: area }))(corner).points).toEqual(corner);
    nodes[1].type = 'junction';
    const edges = [syntheticEdge(nodes[0], nodes[1], { pathType: 'entrance', geometry: corner })];
    expect(createRouteSmoother(syntheticGraph(nodes, edges, { navigableAreas: area }))(corner).points).toEqual(corner);
    const branch = syntheticNode('branch', [30, 0]);
    expect(createRouteSmoother(syntheticGraph([...nodes, branch], [
      syntheticEdge(nodes[0], nodes[1]), syntheticEdge(nodes[1], nodes[2]), syntheticEdge(nodes[1], branch),
    ], { navigableAreas: area }))(corner).points.length).toBeGreaterThan(corner.length);
  });

  it('preserves accessibility and restriction transitions at ordinary junctions', () => {
    const nodes = corner.map((p, i) => syntheticNode(String(i), p));
    for (const transition of [{ accessibility: 'unknown' as const }, { restriction: 'closed' as const }]) {
      const g = syntheticGraph(nodes, [
        syntheticEdge(nodes[0], nodes[1]), syntheticEdge(nodes[1], nodes[2], transition),
      ], { navigableAreas: area });
      expect(createRouteSmoother(g)(corner).points).toEqual(corner);
    }
  });

  it('uses visibly larger trims and keeps sampled joins tangent without overlapping adjacent curves', () => {
    const points: Point[] = [[-80, 0], [0, 0], [0, 80], [80, 80]];
    let corners: readonly CornerDiagnostic[] = [];
    const visual = createRouteSmoother(graph())(points, { onDiagnostics: value => { corners = value; } });
    expect(corners.every(c => c.acceptedRadius > 30)).toBe(true);
    // Every rendered direction change, including straight/curve joins, is small.
    for (let i = 1; i < visual.points.length - 1; i++) {
      const [a, b, c] = visual.points.slice(i - 1, i + 2);
      const incoming = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const outgoing = Math.atan2(c[1] - b[1], c[0] - b[0]);
      expect(Math.abs(Math.atan2(Math.sin(outgoing - incoming), Math.cos(outgoing - incoming)))).toBeLessThan(0.04);
      expect(visual.sourceDistances[i]).toBeGreaterThan(visual.sourceDistances[i - 1]);
    }
  });

  it('refines the largest safe trim instead of retaining a needlessly small halved candidate', () => {
    const g = graph();
    g.navigableAreas = [
      [[-1, -0.3], [20.3, -0.3], [20.3, 0.3], [-1, 0.3]],
      [[19.7, -0.3], [20.3, -0.3], [20.3, 21], [19.7, 21]],
    ];
    let corners: readonly CornerDiagnostic[] = [];
    const visual = createRouteSmoother(g)(corner, { onDiagnostics: value => { corners = value; } });
    expect(corners[0].rejectedCandidates).toBeGreaterThan(0);
    expect(corners[0].acceptedRadius).toBeGreaterThan(1.1);
    expect(corners[0].acceptedRadius).toBeLessThanOrEqual(1.2);
    expect(safePolyline(visual.points, g)).toBe(true);
  });

  it('removes safe small zigzags without dropping locked anchors or changing playback length', () => {
    const points: Point[] = [[0, 0], [20, 0], [23, 1], [40, 0], [60, 0], [60, 40]];
    let corners: readonly CornerDiagnostic[] = [];
    const visual = createRouteSmoother(graph())(points, { onDiagnostics: value => { corners = value; } });
    expect(corners.some(c => c.reason === 'safe-simplification' && c.sourceIndex === 2)).toBe(true);
    expect(visual.points.some(p => p[1] !== 0 && p[0] < 40)).toBe(false);
    expect(visual.sourceLength).toBeCloseTo(20 + Math.sqrt(10) + Math.sqrt(290) + 20 + 40);
    expect(createRouteSmoother(graph())(points, { protectedIndices: [2] }).points).toContainEqual(points[2]);
  });

  it('fails closed without valid enclosure evidence and owns its snapshot', () => {
    const g = graph(), smooth = createRouteSmoother(g);
    g.navigableAreas = [];
    expect(smooth(corner).points.length).toBeGreaterThan(3);
    expect(createRouteSmoother(g)(corner).points).toEqual(corner);
    g.navigableAreas = [[[0, 0], [1, 1]]];
    expect(createRouteSmoother(g)(corner).points).toEqual(corner);
    expect(smooth(corner, { maxSegmentLength: 0 }).points).toEqual(corner);
    expect(smooth(corner, { segmentFraction: 1 }).points).toEqual(corner);
    expect(smooth([[NaN, 0], [1, 1]]).points).toEqual([]);
  });

  it('reveals fixed samples continuously with original distance stations', () => {
    const output = createRouteSmoother(graph())(corner);
    expect(output.sourceLength).toBe(40);
    expect(clipVisualRouteAtProgress(output, 0)).toEqual([[0, 0]]);
    expect(clipVisualRouteAtProgress(output, 0.25).at(-1)).toEqual([10, 0]);
    expect(clipVisualRouteAtProgress(output, 0.75).at(-1)![0]).toBe(20);
    expect(clipVisualRouteAtProgress(output, 0.75).at(-1)![1]).toBeCloseTo(10, 12);
    expect(clipVisualRouteAtProgress(output, 1)).toEqual(output.points);
    let previous = corner[0];
    for (let i = 1; i <= 1000; i++) {
      const visible = clipVisualRouteAtProgress(output, i / 1000);
      expect(visible.slice(0, -1)).toEqual(output.points.slice(0, visible.length - 1));
      const last = visible.at(-1)!;
      expect(Math.hypot(last[0] - previous[0], last[1] - previous[1])).toBeLessThanOrEqual(0.041);
      previous = last;
    }
  });
});
