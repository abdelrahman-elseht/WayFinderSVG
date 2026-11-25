import { createHash } from 'node:crypto';
import type { FloorBundle } from '@wayfinding/map-engine';

const sourceMapRevision: Record<string, string> = {
  GF: '96108092be9fe309',
  '01': 'e21e531eaa0226e8',
};

export function publicNavigationBundle(bundle: FloorBundle): FloorBundle {
  const { adminAuthoring: _adminAuthoring, ...graph } = bundle.graph;
  const revision = bundle.floorData.building.id === 'B03' ? sourceMapRevision[bundle.floorData.floor.id] : undefined;
  const floorData = revision
    ? { ...bundle.floorData, floor: { ...bundle.floorData.floor, mapAsset: `${bundle.floorData.floor.mapAsset}?v=${revision}` } }
    : bundle.floorData;
  return { ...bundle, floorData, graph };
}

export function publicMapBundle(bundle: FloorBundle): FloorBundle {
  const publicBundle = publicNavigationBundle(bundle);
  return {
    ...publicBundle,
    graph: {
      ...publicBundle.graph,
      nodes: publicBundle.graph.nodes.filter(node => node.type === 'elevator' || node.type === 'escalator'),
      edges: [],
      walls: [],
      navigableAreas: [],
      floorConstraints: undefined,
    },
  };
}

export function publicNavigationRevision(bundle: FloorBundle): string {
  return createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
}
