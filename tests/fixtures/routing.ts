import type { NavigationEdge, NavigationGraph, NavigationNode, Point } from '@wayfinding/map-engine';

// SYNTHETIC TEST DATA ONLY. This geometry has no relationship to B03 or any real building.
export function syntheticNode(id: string, point: Point, overrides: Partial<NavigationNode> = {}): NavigationNode {
  return { id, point, buildingId: 'SYNTHETIC_TEST_BUILDING', floorId: 'TEST_F0', type: 'junction', status: 'confirmed', ...overrides };
}

export function syntheticEdge(from: NavigationNode, to: NavigationNode, overrides: Partial<NavigationEdge> = {}): NavigationEdge {
  return { id: `${from.id}-${to.id}`, from: from.id, to: to.id, floorId: from.floorId, pathType: 'corridor',
    distance: Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1]), distanceUnit: 'map-unit',
    accessibility: 'confirmed', restriction: 'open', status: 'confirmed', bidirectional: true,
    geometry: [from.point, to.point], ...overrides };
}

export function syntheticGraph(nodes: NavigationNode[], edges: NavigationEdge[], overrides: Partial<NavigationGraph> = {}): NavigationGraph {
  return { nodes, edges, metersPerUnit: null, calibrationStatus: 'unknown', navigableAreas: [], walls: [], status: 'confirmed', ...overrides };
}

export function syntheticCorner() {
  const a = syntheticNode('a', [0, 0]);
  const b = syntheticNode('b', [10, 0]);
  const c = syntheticNode('c', [10, 10], { type: 'door', roomId: 'synthetic-room' });
  return syntheticGraph([a, b, c], [syntheticEdge(a, b), syntheticEdge(b, c, { pathType: 'door' })]);
}
