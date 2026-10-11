import type { NavigationGraph, Point } from '@wayfinding/map-engine';

/** Synthetic obstacle cases, never shipped as First Floor architectural data. */
export function syntheticDrawingCorridor(): NavigationGraph {
  return {
    nodes: [
      { id: 'synthetic-a', buildingId: 'SYNTHETIC', floorId: '01', point: [0, 5], type: 'junction', status: 'candidate' },
      { id: 'synthetic-b', buildingId: 'SYNTHETIC', floorId: '01', point: [10, 5], type: 'junction', status: 'candidate' },
    ],
    edges: [{ id: 'synthetic-edge', from: 'synthetic-a', to: 'synthetic-b', floorId: '01', pathType: 'corridor',
      distance: 10, distanceUnit: 'map-unit', accessibility: 'unknown', restriction: 'unknown', status: 'candidate',
      bidirectional: true, geometry: [[0, 5], [10, 5]] }],
    metersPerUnit: null, calibrationStatus: 'unknown', status: 'candidate', routingPolicy: 'drawing-based',
    walls: [], navigableAreas: [[[-1, -1], [11, -1], [11, 11], [-1, 11]]],
  };
}

export function replaceSyntheticLine(graph: NavigationGraph, points: Point[]) {
  graph.nodes[0].point = points[0];
  graph.nodes[1].point = points.at(-1)!;
  graph.edges[0].geometry = points;
  graph.edges[0].distance = points.slice(1).reduce((total, point, i) => total + Math.hypot(point[0]-points[i][0], point[1]-points[i][1]), 0);
}
