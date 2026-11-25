import { describe, expect, it } from 'vitest';
import type { FloorBundle, NavigationEdge, NavigationGraph, NavigationNode, Point } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { multiFloorNavigation } from '../../apps/web/lib/multi-floor-navigation';
import { FLOOR_TRANSITION_LEAD_IN_MS, playbackPlanDuration, playbackPlanPosition, routePlaybackPlan } from '../../apps/web/components/routePlayback';
import { validConstraints } from '../../packages/routing/src/geometry-safety';

const area = (left: number, right: number): Point[] => [[left, -2], [right, -2], [right, 2], [left, 2]];

function node(id: string, floorId: 'GF' | '01', point: Point, type: NavigationNode['type'] = 'junction'): NavigationNode {
  return { id, buildingId: 'B03', floorId, point, type, status: 'candidate',
    ...(type === 'elevator' || type === 'escalator' ? {
      transitionId: 'B03-transition-synthetic', transitionName: 'Synthetic vertical link',
      transitionAccessibility: 'confirmed' as const, transitionRestriction: 'open' as const,
    } : {}) };
}

function edge(from: NavigationNode, to: NavigationNode): NavigationEdge {
  return { id: `${from.id}-${to.id}`, from: from.id, to: to.id, floorId: from.floorId,
    pathType: 'corridor', distance: Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1]),
    distanceUnit: 'map-unit', accessibility: 'confirmed', restriction: 'open', status: 'candidate',
    bidirectional: true, geometry: [from.point, to.point] };
}

function bundle(floorId: 'GF' | '01', nodes: NavigationNode[], edges: NavigationEdge[], walls: [Point, Point][] = []): FloorBundle {
  const graph: NavigationGraph = { routingPolicy: 'drawing-based', nodes, edges, metersPerUnit: null,
    calibrationStatus: 'unknown', navigableAreas: [area(-1, 21)], walls, status: 'candidate' };
  return { floorData: { floor: { id: floorId, level: floorId === 'GF' ? 0 : 1 } } as FloorBundle['floorData'],
    graph, contents: [] } as FloorBundle;
}

describe('paired vertical navigation', () => {
  it('creates no cross-floor route until a transition has two matching opposite-floor landings', () => {
    const start = node('gf-start', 'GF', [0, 0]);
    const groundLanding = node('gf-lift', 'GF', [10, 0], 'elevator');
    const firstLanding = node('f1-lift', '01', [10, 0], 'elevator');
    const destination = node('f1-destination', '01', [20, 0]);
    const ground = bundle('GF', [start, groundLanding], [edge(start, groundLanding)]);
    const first = bundle('01', [firstLanding, destination], [edge(firstLanding, destination)]);
    const unpaired = multiFloorNavigation([ground]);
    expect(findRoute(unpaired, start.id, destination.id).status).toBe('unconfirmed');

    const combined = multiFloorNavigation([ground, first]);
    expect(combined.edges.find(item => item.id === 'vertical-B03-transition-synthetic')).toMatchObject({
      pathType: 'elevator', from: groundLanding.id, to: firstLanding.id, accessibility: 'confirmed',
      restriction: 'open', distance: 0, bidirectional: true,
    });
    expect(findRoute(combined, start.id, destination.id).instructions.map(item => item.type)).toContain('elevator');
    expect(findRoute(combined, start.id, destination.id, { accessibleOnly: true }).status).toBe('ok');

    const mismatchedLanding = { ...firstLanding, type: 'escalator' as const };
    const mismatched = multiFloorNavigation([
      ground,
      bundle('01', [mismatchedLanding, destination], [edge(mismatchedLanding, destination)]),
    ]);
    expect(mismatched.edges.some(item => item.id === 'vertical-B03-transition-synthetic')).toBe(false);
    expect(findRoute(mismatched, start.id, destination.id).status).toBe('unavailable');
  });

  it('uses the escalator instruction and excludes escalators from step-free routes', () => {
    const start = node('gf-start', 'GF', [0, 0]);
    const groundLanding = node('gf-escalator', 'GF', [10, 0], 'escalator');
    const firstLanding = node('f1-escalator', '01', [10, 0], 'escalator');
    const destination = node('f1-destination', '01', [20, 0]);
    const combined = multiFloorNavigation([
      bundle('GF', [start, groundLanding], [edge(start, groundLanding)]),
      bundle('01', [firstLanding, destination], [edge(firstLanding, destination)]),
    ]);
    const route = findRoute(combined, start.id, destination.id);
    expect(route.instructions.find(item => item.type === 'escalator')?.text.en).toContain('escalator');
    expect(findRoute(combined, start.id, destination.id, { accessibleOnly: true }).status).toBe('unavailable');
  });

  it('does not route across a closed paired lift', () => {
    const start = node('gf-start', 'GF', [0, 0]);
    const groundLanding = { ...node('gf-lift', 'GF', [10, 0], 'elevator'), transitionRestriction: 'closed' as const };
    const firstLanding = { ...node('f1-lift', '01', [10, 0], 'elevator'), transitionRestriction: 'closed' as const };
    const destination = node('f1-destination', '01', [20, 0]);
    const combined = multiFloorNavigation([
      bundle('GF', [start, groundLanding], [edge(start, groundLanding)]),
      bundle('01', [firstLanding, destination], [edge(firstLanding, destination)]),
    ]);
    expect(findRoute(combined, start.id, destination.id).status).toBe('unavailable');
  });

  it('keeps route checks scoped to the floor being traversed and switches playback legs at a landing', () => {
    const start = node('gf-start', 'GF', [0, 0]);
    const groundLanding = node('gf-lift', 'GF', [10, 0], 'elevator');
    const firstLanding = node('f1-lift', '01', [10, 0], 'elevator');
    const destination = node('f1-destination', '01', [20, 0]);
    const ground = bundle('GF', [start, groundLanding], [edge(start, groundLanding)]);
    const first = bundle('01', [firstLanding, destination], [edge(firstLanding, destination)], [[[5, -1], [5, 1]]]);
    const combined = multiFloorNavigation([ground, first]);
    expect(validConstraints(combined)).toBe(true);
    expect(findRoute(combined, start.id, groundLanding.id)).toMatchObject({ status: 'ok' });
    const route = findRoute(combined, start.id, destination.id);
    expect(route.status).toBe('ok');

    const clearFirst = bundle('01', [firstLanding, destination], [edge(firstLanding, destination)]);
    const clearRoute = findRoute(multiFloorNavigation([ground, clearFirst]), start.id, destination.id);
    const parts = routePlaybackPlan(multiFloorNavigation([ground, clearFirst]), clearRoute);
    expect(parts.map(part => part.kind)).toEqual(['floor', 'transition', 'floor']);
    expect(parts.map(part => part.floorId)).toEqual(['GF', '01', '01']);
    expect(parts[0].kind === 'floor' ? parts[0].points : []).toEqual([[0, 0], [10, 0]]);
    expect(parts[1]).toMatchObject({ kind: 'transition', floorId: '01', points: [[10, 0]], framePoints: [[10, 0], [20, 0]], duration: FLOOR_TRANSITION_LEAD_IN_MS });
    expect(playbackPlanDuration(parts)).toBe(2000);
    expect(playbackPlanPosition(parts, 0.5)).toMatchObject({ part: { kind: 'transition', floorId: '01' }, partProgress: 0.5 });
    expect(playbackPlanPosition(parts, 0.55)?.part.floorId).toBe('01');
    expect(playbackPlanPosition(parts, 0.55)?.part.kind).toBe('floor');
  });
});
