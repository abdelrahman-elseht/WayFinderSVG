import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateFloorBundle, type FloorBundle } from '@wayfinding/map-engine';

export type NavigationFloorId = 'GF' | '01';

export function navigationStorePath(floorId: NavigationFloorId): string {
  const configured = process.env.WAYFINDING_NAVIGATION_STORE;
  if (configured) {
    const target = path.resolve(configured);
    return floorId === 'GF' ? target : `${target}.01`;
  }
  const target = path.join(process.cwd(), '.data', 'navigation', 'B03-GF.json');
  return floorId === 'GF' ? target : `${target}.01`;
}

/** Reconcile deleted endpoints in memory without rewriting source room evidence. */
export function navigationFloorData(floorData: FloorBundle['floorData'], graph: FloorBundle['graph']) {
  const nodes = new Set(graph.nodes.map(node => node.id));
  const roomNodes = new Map(graph.nodes.filter(node => node.roomId).map(node => [node.roomId, node.id]));
  const rooms = floorData.rooms.map(room => room.doorNodeId && !nodes.has(room.doorNodeId)
    ? { ...room, doorNodeId: roomNodes.get(room.id) ?? null } : room);
  const defaults = floorData.navigationDefaults;
  return {
    ...floorData,
    rooms,
    kiosks: floorData.kiosks.map(kiosk => kiosk.nodeId && !nodes.has(kiosk.nodeId)
      ? { ...kiosk, nodeId: null, status: 'unknown' as const } : kiosk),
    navigationDefaults: defaults && rooms.some(room => room.id === defaults.startRoomId && room.doorNodeId)
      ? defaults : undefined,
  };
}

/** No process cache: every public request observes the last atomic publication. */
export async function publishedNavigation(
  floorId: NavigationFloorId,
  floorData: unknown,
  canonicalGraph: unknown,
  contents: unknown,
): Promise<FloorBundle> {
  let resolvedFloor = floorData;
  let graph = canonicalGraph;
  try {
    const snapshot = JSON.parse(await readFile(navigationStorePath(floorId), 'utf8'));
    if (snapshot.schemaVersion !== 1 || snapshot.buildingId !== 'B03' || snapshot.floorId !== floorId
      || typeof snapshot.revision !== 'string' || !snapshot.graph) {
      throw new Error(`Invalid navigation publication for B03/${floorId}`);
    }
    graph = snapshot.graph;
    if (snapshot.floorData !== undefined) {
      if (!snapshot.floorData || snapshot.floorData.floor?.id !== floorId
        || snapshot.floorData.building?.id !== 'B03') {
        throw new Error(`Invalid published floor data for B03/${floorId}`);
      }
      resolvedFloor = snapshot.floorData;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  // Structural errors fail closed; routing separately checks walls/area containment.
  return validateFloorBundle(
    navigationFloorData(resolvedFloor as FloorBundle['floorData'], graph as FloorBundle['graph']),
    graph, contents, { allowUnsafeGeometry: true },
  );
}
