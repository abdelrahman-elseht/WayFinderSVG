import type { FloorBundle, NavigationEdge, NavigationGraph, NavigationNode } from '@wayfinding/map-engine';

export function multiFloorNavigation(bundles: FloorBundle[]): NavigationGraph {
  const nodes = bundles.flatMap(bundle => bundle.graph.nodes);
  const edges = bundles.flatMap(bundle => bundle.graph.edges);
  const transitionNodes = new Map<string, NavigationNode[]>();
  for (const node of nodes) {
    if (!node.transitionId || (node.type !== 'escalator' && node.type !== 'elevator')) continue;
    transitionNodes.set(node.transitionId, [...(transitionNodes.get(node.transitionId) ?? []), node]);
  }

  const transitions: NavigationEdge[] = [];
  for (const [transitionId, endpoints] of transitionNodes) {
    if (endpoints.length !== 2) continue;
    const [from, to] = endpoints;
    if (from.floorId === to.floorId || from.type !== to.type
      || from.transitionName !== to.transitionName
      || from.transitionAccessibility !== to.transitionAccessibility
      || from.transitionRestriction !== to.transitionRestriction) continue;
    transitions.push({
      id: `vertical-${transitionId}`,
      from: from.id,
      to: to.id,
      floorId: from.floorId,
      pathType: from.type === 'escalator' ? 'escalator' : 'elevator',
      distance: 0,
      distanceUnit: 'map-unit',
      accessibility: from.transitionAccessibility ?? 'unknown',
      restriction: from.transitionRestriction ?? 'unknown',
      status: 'candidate',
      bidirectional: true,
      geometry: [from.point, to.point],
    });
  }

  return {
    routingPolicy: 'drawing-based',
    nodes,
    edges: [...edges, ...transitions],
    metersPerUnit: null,
    calibrationStatus: 'unknown',
    navigableAreas: [],
    walls: [],
    status: 'candidate',
    floorConstraints: Object.fromEntries(bundles.map(bundle => [bundle.floorData.floor.id, {
      walls: bundle.graph.walls,
      navigableAreas: bundle.graph.navigableAreas,
    }])),
  };
}

export function routeGraphForTransition(graph: NavigationGraph, transitionId: string): NavigationGraph {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  return {
    ...graph,
    edges: graph.edges.filter(edge => {
      if (edge.pathType !== 'elevator' && edge.pathType !== 'escalator') return true;
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to || from.floorId === to.floorId) return true;
      return edge.id === `vertical-${transitionId}`;
    }),
  };
}
