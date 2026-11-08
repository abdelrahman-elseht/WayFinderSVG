import type { FloorData, NavigationGraph, Point } from '@wayfinding/map-engine';

export type Spine = { id: string; index: number; kind: 'spine' | 'connection'; coordinates: Point[]; sourceReferences: string[]; note?: string };
export type Control = { id: string; spine: string; index: number; point: Point; protected: boolean };
export type NodeMoves = Record<string, Point>;
export type Settings = { minimum: number; preferred: number; maximum: number };
export type Diagnostic = { id: string; changed: boolean; state: 'red' | 'orange' | 'green' | 'unchecked'; wallClearance: number | null; walkableBoundaryClearance: number | null; nearbyWallIndices: number[]; tests: { safe: boolean; areaCovered: boolean; wallIndices: number[]; roomInteriors: string[] } | null };
export type EdgeEvidence = { edgeId: string; sourceSpineIds: number[]; sourceReferences: string[]; tests: unknown; wallClearance?: number; walkableBoundaryClearance?: number };
export type RoomConnection = { nodeId: string; room: string; point: Point; attachment: Point | null; method?: string; incidentEdgeCount: number; componentIndex?: number; connected: boolean };
export type Session = { revision: string; spines: Spine[]; floor: FloorData; graph: NavigationGraph; runtimeGraph: NavigationGraph; config: Record<string, unknown>; evidence: EdgeEvidence[]; candidates: string[] };
export type GraphEditImpact = { affectedRoomEndpointIds: string[]; incidentEdgeIds: string[]; disconnectedRoomPairs: string[][]; requiredRoomPairs: string[][]; unresolvedDanglingEndpointCount: number; unresolvedDanglingEndpointIds: string[] };
export type Report = { valid: boolean; draftOnly?: boolean; safetyChecked?: boolean; previewError?: string; diagnostics: Diagnostic[]; changes: { id: string; before: Point[]; after: Point[]; displacement: number }[]; errors: unknown[]; graph?: NavigationGraph; runtimeGraph?: NavigationGraph; report?: { edgeEvidence: EdgeEvidence[] }; validation?: Record<string, unknown>; revision?: string; candidate?: string; saved?: boolean; backup?: string; lostRoomPairs?: [string, string][]; requiredRouteFailures?: [string, string][]; unattachedSupportedRooms?: string[]; roomConnections?: RoomConnection[]; graphEditImpact?: GraphEditImpact };
export const controls = (spines: Spine[]): Control[] => spines.flatMap(s => s.coordinates.map((point, index) => ({
  id: `${s.id}/${index}`, spine: s.id, index, point, protected: false,
})));

export function moveGraphNodes(graph: NavigationGraph, moves: NodeMoves): NavigationGraph {
  const points = new Map(graph.nodes.map(node => [node.id, moves[node.id] || node.point]));
  const length = (points: Point[]) => points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);
  return {
    ...graph,
    nodes: graph.nodes.map(node => ({ ...node, point: points.get(node.id)! })),
    edges: graph.edges.map(edge => {
      if (!edge.geometry.length) return edge;
      const geometry = edge.geometry.map(point => [...point] as Point);
      geometry[0] = points.get(edge.from)!;
      geometry[geometry.length - 1] = points.get(edge.to)!;
      return { ...edge, geometry, distance: length(geometry) };
    }),
  };
}

function projectAlong(point: Point, line: Point[]): number {
  let total = 0, best = 0, bestDistance = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy), t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (length * length))) : 0;
    const q: Point = [a[0] + dx * t, a[1] + dy * t], distance = Math.hypot(point[0] - q[0], point[1] - q[1]);
    if (distance < bestDistance) { bestDistance = distance; best = total + length * t; }
    total += length;
  }
  return total ? best / total : 0;
}

function pointAlong(line: Point[], fraction: number): Point {
  const lengths = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
  const target = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, fraction));
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const length = lengths[i - 1];
    if (walked + length >= target) { const t = length ? (target - walked) / length : 0; return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]; }
    walked += length;
  }
  return [...line.at(-1)!];
}

/** Propagate edited source spines to evidence-linked junction nodes and edges. */
export function propagateSourceLinks(graph: NavigationGraph, original: Spine[], edited: Spine[], evidence: EdgeEvidence[]): NavigationGraph {
  const byIndex = new Map(original.map(spine => [spine.index, spine]));
  const changed = new Map<number, Spine>();
  for (const spine of edited) if (JSON.stringify(spine.coordinates) !== JSON.stringify(byIndex.get(spine.index)?.coordinates)) changed.set(spine.index, spine);
  if (!changed.size) return graph;
  const moves: NodeMoves = {};
  for (const item of evidence) {
    const owners = item.sourceSpineIds.filter(index => changed.has(index));
    if (!owners.length) continue;
    const edge = graph.edges.find(candidate => candidate.id === item.edgeId); if (!edge) continue;
    for (const id of [edge.from, edge.to]) {
      const node = graph.nodes.find(candidate => candidate.id === id);
      // Room approach points are independent evidence; only move junction/attachment nodes.
      if (!node || node.roomId || moves[id]) continue;
      let best: Point | undefined, distance = Infinity;
      for (const index of owners) {
        const before = byIndex.get(index), after = changed.get(index)!; if (!before) continue;
        const fraction = projectAlong(node.point, before.coordinates), point = pointAlong(after.coordinates, fraction);
        const d = Math.hypot(node.point[0] - point[0], node.point[1] - point[1]);
        if (d < distance) { distance = d; best = point; }
      }
      if (best) moves[id] = best;
    }
  }
  return moveGraphNodes(graph, moves);
}

/** One snapped delta for the entire group, never independently round its points. */
export function translate(spines: Spine[], ids: Set<string>, delta: Point, grid = 0): Spine[] {
  if (!delta.every(Number.isFinite)) return spines;
  const offset = delta.map(v => grid > 0 ? Math.round(v / grid) * grid : v) as Point;
  return spines.map(s => ({ ...s, coordinates: s.coordinates.map((p, i) => ids.has(`${s.id}/${i}`) ? [p[0] + offset[0], p[1] + offset[1]] : p) }));
}

export function inside(point: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

export function rectangleSelection(items: Control[], start: Point, end: Point, radius: number): string[] {
  const crossing = end[0] < start[0];
  const [left, right] = [Math.min(start[0], end[0]), Math.max(start[0], end[0])];
  const [top, bottom] = [Math.min(start[1], end[1]), Math.max(start[1], end[1])];
  return items.filter(({ point: [x, y] }) => crossing
    ? x + radius >= left && x - radius <= right && y + radius >= top && y - radius <= bottom
    : x - radius >= left && x + radius <= right && y - radius >= top && y + radius <= bottom).map(n => n.id);
}

export function selectionStats(items: Control[]) {
  if (!items.length) return null;
  const x = items.map(n => n.point[0]), y = items.map(n => n.point[1]);
  return { count: items.length, bounds: [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)],
    average: [x.reduce((a, b) => a + b, 0) / x.length, y.reduce((a, b) => a + b, 0) / y.length] as Point };
}

export function deleteControls(spines: Spine[], ids: Set<string>) {
  return spines.map(s => ({ ...s, coordinates: s.coordinates.filter((_, i) => i === 0 || i === s.coordinates.length - 1 || !ids.has(`${s.id}/${i}`)) }));
}

export function pointSegmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function exportConfig(session: Session, spines: Spine[]) {
  const config = structuredClone(session.config) as { reviewedSpineOverrides?: { spineIndex: number; coordinates: Point[]; id: string; sourceReferences: string[]; note: string }[]; reviewedConnections: { id: string; coordinates: Point[]; sourceReferences?: string[]; note?: string }[] };
  config.reviewedConnections = config.reviewedConnections.filter(c => spines.some(s => s.id === 'connection:' + c.id));
  for (const spine of spines) {
    if (JSON.stringify(spine.coordinates) === JSON.stringify(session.spines.find(s => s.id === spine.id)?.coordinates)) continue;
    if (spine.kind === 'connection') {
      const target = config.reviewedConnections.find(c => 'connection:' + c.id === spine.id);
      if (target) target.coordinates = spine.coordinates;
      else config.reviewedConnections.push({ id: spine.id.slice(11), coordinates: spine.coordinates, sourceReferences: spine.sourceReferences, note: spine.note });
    } else {
      const overrides = config.reviewedSpineOverrides ??= [];
      const target = overrides.find(o => o.spineIndex === spine.index);
      if (target) target.coordinates = spine.coordinates;
      else overrides.push({ spineIndex: spine.index, coordinates: spine.coordinates, id: `admin-spine-${spine.index}`, sourceReferences: spine.sourceReferences, note: 'Administrator-edited diagnostic candidate; requires reconstruction and validation.' });
    }
  }
  return config;
}
