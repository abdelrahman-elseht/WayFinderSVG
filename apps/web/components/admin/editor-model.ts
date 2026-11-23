import type { FloorData, NavigationAuthoringEdits, NavigationGraph, Point } from '@wayfinding/map-engine';

export type Spine = { id: string; index: number; kind: 'spine' | 'connection'; coordinates: Point[]; sourceReferences: string[]; note?: string };
export type Control = { id: string; spine: string; index: number; point: Point; protected: boolean };
export type CoincidenceMember = { id: string; kind: 'source' | 'graph'; point: Point };
export type CoincidenceCluster = { id: string; point: Point; members: CoincidenceMember[] };
export type ScreenTransform = { a: number; b: number; c: number; d: number; e: number; f: number };
export type PickHandle = CoincidenceMember & { visible: boolean; locked: boolean; selectable: boolean };
export const HANDLE_PICK_RADIUS = 10;
export const HANDLE_DRAG_THRESHOLD = 4;

/** Project through the SVG CTM: a CSS-pixel circle remains exact under skew/nonuniform zoom. */
export function pickHandles(items: PickHandle[], client: Point, matrix: ScreenTransform, radius = HANDLE_PICK_RADIUS): CoincidenceMember[] {
  if (![...client, matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f, radius].every(Number.isFinite) || radius < 0 || matrix.a * matrix.d - matrix.b * matrix.c === 0) return [];
  return items.filter(item => item.visible && item.selectable && !item.locked).map(item => ({ item, distance: Math.hypot(
    matrix.a * item.point[0] + matrix.c * item.point[1] + matrix.e - client[0],
    matrix.b * item.point[0] + matrix.d * item.point[1] + matrix.f - client[1],
  ) })).filter(hit => hit.distance <= radius).sort((a, b) => a.distance - b.distance
    || (a.item.kind === b.item.kind ? 0 : a.item.kind === 'source' ? -1 : 1)
    || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0)).map(hit => hit.item);
}

export function selectHandle(sourceIds: Set<string>, graphIds: Set<string>, member: CoincidenceMember, additive: boolean, replace?: CoincidenceMember) {
  const sources = new Set(sourceIds), nodes = new Set(graphIds);
  const selected = (member.kind === 'source' ? sources : nodes).has(member.id);
  if (!additive && !selected && !replace) { sources.clear(); nodes.clear(); }
  if (replace && !selected) (replace.kind === 'source' ? sources : nodes).delete(replace.id);
  const own = member.kind === 'source' ? sources : nodes;
  if (additive && selected) own.delete(member.id); else own.add(member.id);
  return { sources, nodes };
}
export type NodeMoves = Record<string, Point>;
export type NodeMerges = Record<string, string>;
export const NODE_MERGE_TOLERANCE = 0.5;

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableValue).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => JSON.stringify(key) + ':' + stableValue(item)).join(',') + '}';
  return JSON.stringify(value);
}

/** Explicit aliases only: proximity never changes graph topology by itself. */
export function mergeGraphNodes(graph: NavigationGraph, merges: NodeMerges, checkCoincidence = true, protectedIds: Set<string> = new Set()) {
  if (!Object.keys(merges).length) return { graph, aliases: {}, edgeIds: Object.fromEntries(graph.edges.map(edge => [edge.id, edge.id])) };
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const resolve = (id: string): string => {
    const seen = new Set<string>();
    while (merges[id]) {
      if (seen.has(id)) throw new Error('Node merges cannot contain cycles.');
      seen.add(id); id = merges[id];
    }
    return id;
  };
  const aliases: NodeMerges = {};
  for (const id of Object.keys(merges).sort()) {
    const targetId = resolve(id), node = nodes.get(id), target = nodes.get(targetId);
    if (!node || !target || id === targetId || node.floorId !== target.floorId || node.buildingId !== target.buildingId) throw new Error('Merge requires distinct existing same-floor junctions.');
    if ([node, target].some(item => item.type !== 'junction' || item.roomId || protectedIds.has(item.id)
      || ['door', 'approach', 'transition'].includes(String((item as unknown as Record<string, unknown>).reason)))) throw new Error('Room, approach and transition identities cannot be merged.');
    const metadata = (item: typeof node) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id' && key !== 'point'));
    if (stableValue(metadata(node)) !== stableValue(metadata(target))) throw new Error('Junction metadata or evidence differs; merge would discard an identity.');
    if (checkCoincidence && Math.hypot(node.point[0] - target.point[0], node.point[1] - target.point[1]) > NODE_MERGE_TOLERANCE) throw new Error('Move the selected junctions on top of each other before merging.');
    aliases[id] = targetId;
  }
  const edgeIds: Record<string, string> = {}, equivalents = new Map<string, string>();
  const edges: NavigationGraph['edges'] = [];
  for (const original of graph.edges) {
    const from = aliases[original.from] || original.from, to = aliases[original.to] || original.to;
    const affected = from !== original.from || to !== original.to;
    if (affected && from === to) continue;
    const geometry = original.geometry.map(point => [...point] as Point);
    if (affected) { geometry[0] = nodes.get(from)!.point; geometry[geometry.length - 1] = nodes.get(to)!.point; }
    const length = geometry.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - geometry[i][0], point[1] - geometry[i][1]), 0);
    const edge = affected ? { ...original, from, to, geometry, distance: length * (original.distanceUnit === 'meter' ? graph.metersPerUnit! : 1) } : original;
    const signature = (item: typeof edge) => stableValue(Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id')));
    const signatureKey = edge.bidirectional && edge.from > edge.to ? signature({ ...edge, from: edge.to, to: edge.from, geometry: [...edge.geometry].reverse() }) : signature(edge);
    const existing = equivalents.get(signatureKey);
    // Only duplicates involving a rewired edge belong to this operation.
    if (existing && (affected || edges.find(item => item.id === existing)?.from !== graph.edges.find(item => item.id === existing)?.from
      || edges.find(item => item.id === existing)?.to !== graph.edges.find(item => item.id === existing)?.to)) { edgeIds[edge.id] = existing; continue; }
    equivalents.set(signatureKey, edge.id); edgeIds[edge.id] = edge.id; edges.push(edge);
  }
  return { graph: { ...graph, nodes: graph.nodes.filter(node => !aliases[node.id]), edges }, aliases, edgeIds };
}

export function mergeSourceLinks(evidence: EdgeEvidence[], edgeIds: Record<string, string>): EdgeEvidence[] {
  // Keep distinct evidence records, even when their equivalent edges coalesce.
  return evidence.flatMap(item => edgeIds[item.edgeId] ? [{ ...item, edgeId: edgeIds[item.edgeId] }] : []);
}
export type AddedGraphEdge = {
  id: string;
  from: string;
  to: string;
  floorId: string;
  pathType: 'corridor';
  distance: number;
  distanceUnit: 'map-unit';
  accessibility: 'unknown';
  restriction: 'unknown';
  status: 'candidate';
  bidirectional: true;
  geometry: Point[];
};
export type AuthoringEdits = Required<NavigationAuthoringEdits>;
export type AddedGraphNode = AuthoringEdits['addedNodes'][number];
export type NavigableAreaEdit = AuthoringEdits['navigableAreaEdits'][number];
export type RoomEndpointBinding = AuthoringEdits['roomEntryBindings'][number];
export type EdgeGeometryEdits = AuthoringEdits['edgeGeometryEdits'];
export const emptyAuthoringEdits = (): AuthoringEdits => ({ addedNodes: [], navigableAreaEdits: [], roomEntryBindings: [], edgeGeometryEdits: {} });

export function authoringEdits(value: Partial<AuthoringEdits> = {}): AuthoringEdits {
  return {
    addedNodes: value.addedNodes || [], navigableAreaEdits: value.navigableAreaEdits || [],
    roomEntryBindings: value.roomEntryBindings || [], edgeGeometryEdits: value.edgeGeometryEdits || {},
  };
}

/** Pending nodes are created at their final coordinates, not moved before they exist. */
export function authoringPayload(edits: AuthoringEdits, moves: NodeMoves): AuthoringEdits {
  return { ...edits, addedNodes: edits.addedNodes.map(node => ({ ...node, point: moves[node.id] || node.point })) };
}

/** Position changes own endpoints; a bend edit never detaches its incident nodes. */
export function anchoredEdgeGeometryEdits(graph: NavigationGraph, edits: EdgeGeometryEdits): EdgeGeometryEdits {
  const nodes = new Map(graph.nodes.map(node => [node.id, node.point]));
  return Object.fromEntries(graph.edges.flatMap(edge => {
    const edit = edits[edge.id];
    return edit ? [[edge.id, { ...edit, geometry: [nodes.get(edge.from)!, ...edit.geometry.slice(1, -1), nodes.get(edge.to)!] }]] : [];
  }));
}

export function applyRoomEntryBindings(floor: FloorData, bindings: RoomEndpointBinding[]): FloorData {
  const endpoints = new Map(bindings.map(binding => [binding.roomId, binding.nodeId]));
  return { ...floor, rooms: floor.rooms.map(room => endpoints.has(room.id) ? {
    ...room, doorNodeId: endpoints.get(room.id)!, navigationPartial: true,
    navigationNote: {
      en: `${room.navigationNote?.en || ''} Administrator-reviewed candidate entrance/approach. Physical access, public access and wheelchair accessibility remain unconfirmed.`.trim(),
      ar: `${room.navigationNote?.ar || ''} \u0645\u062f\u062e\u0644 \u0623\u0648 \u0646\u0642\u0637\u0629 \u0627\u0642\u062a\u0631\u0627\u0628 \u0645\u0631\u0634\u062d\u0629 \u0631\u0627\u062c\u0639\u0647\u0627 \u0627\u0644\u0645\u0633\u0624\u0648\u0644. \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0641\u0639\u0644\u064a \u0648\u0625\u0645\u0643\u0627\u0646\u064a\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u063a\u064a\u0631 \u0645\u0624\u0643\u062f\u064a\u0646.`.trim(),
    },
  } : room) };
}

export function applyEdgeGeometryEdits(graph: NavigationGraph, edits: EdgeGeometryEdits): NavigationGraph {
  return {
    ...graph,
    edges: graph.edges.map(edge => {
      const edit = edits[edge.id];
      if (!edit) return edge;
      const geometry = edit.geometry;
      const distance = geometry.slice(1).reduce((sum, point, index) =>
        sum + Math.hypot(point[0] - geometry[index][0], point[1] - geometry[index][1]), 0);
      return { ...edge, geometry, status: 'candidate', accessibility: 'unknown', distance: distance * (edge.distanceUnit === 'meter' ? graph.metersPerUnit || 1 : 1) };
    }),
  };
}

export function createCandidateNode(
  floorId: 'GF' | '01',
  point: Point,
  type: 'junction' | 'entrance',
  roomId?: string,
  sourceReference = '',
  note = '',
): AddedGraphNode {
  return {
    id: `B03-${floorId}-admin-node-${crypto.randomUUID().replaceAll('-', '')}`,
    buildingId: 'B03',
    floorId,
    point,
    type,
    ...(roomId ? { roomId } : {}),
    status: 'candidate',
    sourceReference,
    note,
  };
}
/** Publish the displayed overlay, retaining explicit intent for draft restore. */
export const graphEditPayload = (explicitNodeMoves: NodeMoves, linkedMoves: NodeMoves = {}) => ({
  nodeMoves: { ...linkedMoves, ...explicitNodeMoves }, explicitNodeMoves,
});
export type Settings = { minimum: number; preferred: number; maximum: number };
export type Diagnostic = { id: string; changed: boolean; state: 'red' | 'orange' | 'green' | 'unchecked'; wallClearance: number | null; walkableBoundaryClearance: number | null; nearbyWallIndices: number[]; tests: { safe: boolean; areaCovered: boolean; wallIndices: number[]; roomInteriors: string[] } | null };
export type EdgeEvidence = { edgeId: string; sourceSpineIds: number[]; sourceReferences: string[]; tests: unknown; preserveOffset?: boolean; wallClearance?: number; walkableBoundaryClearance?: number };
export type RoomConnection = { nodeId: string; room: string; point: Point; attachment: Point | null; method?: string; incidentEdgeCount: number; componentIndex?: number; connected: boolean };
export type TransitionCandidate = { transitionId: string; transitionName: string; type: 'escalator' | 'elevator'; transitionAccessibility: 'confirmed' | 'inaccessible' | 'unknown'; transitionRestriction: 'open' | 'closed' | 'unknown'; floorId: string; id: string };
export type Session = { revision: string; spines: Spine[]; floor: FloorData; graph: NavigationGraph; runtimeGraph: NavigationGraph; config: Record<string, unknown>; evidence: EdgeEvidence[]; candidates: string[]; transitionCandidates?: TransitionCandidate[]; mergeProtectedNodeIds?: string[]; authoringSourceReferences?: string[] };
export type GraphEditImpact = { affectedRoomEndpointIds: string[]; incidentEdgeIds: string[]; disconnectedRoomPairs: string[][]; requiredRoomPairs: string[][]; unresolvedDanglingEndpointCount: number; unresolvedDanglingEndpointIds: string[] };
export type Report = { valid: boolean; draftOnly?: boolean; safetyChecked?: boolean; previewError?: string; diagnostics: Diagnostic[]; changes: { id: string; before: Point[]; after: Point[]; displacement: number }[]; errors: unknown[]; graph?: NavigationGraph; floor?: FloorData; runtimeGraph?: NavigationGraph; report?: { edgeEvidence: EdgeEvidence[] }; validation?: Record<string, unknown>; revision?: string; candidate?: string; saved?: boolean; backup?: string; lostRoomPairs?: [string, string][]; requiredRouteFailures?: [string, string][]; unattachedSupportedRooms?: string[]; roomConnections?: RoomConnection[]; graphEditImpact?: GraphEditImpact };
export const controls = (spines: Spine[]): Control[] => spines.flatMap(s => s.coordinates.map((point, index) => ({
  id: `${s.id}/${index}`, spine: s.id, index, point, protected: false,
})));

/** Group handles that occupy the same drawing location without changing their semantic IDs. */
export function coincidenceClusters(items: CoincidenceMember[], tolerance = 0.5): CoincidenceCluster[] {
  const sorted = [...items].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'source' ? -1 : 1) || a.id.localeCompare(b.id));
  const parent = sorted.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++)
    if (Math.hypot(sorted[i].point[0] - sorted[j].point[0], sorted[i].point[1] - sorted[j].point[1]) <= tolerance) join(i, j);
  const groups = new Map<number, CoincidenceMember[]>();
  sorted.forEach((item, index) => { const root = find(index); groups.set(root, [...(groups.get(root) ?? []), item]); });
  return [...groups.values()].map((members, index) => ({ id: `cluster-${index}-${members[0].point.join('-')}`, point: [...members[0].point], members }));
}

export function nextCoincidenceMember(cluster: CoincidenceCluster, currentId?: string): CoincidenceMember {
  const current = cluster.members.findIndex(member => member.id === currentId);
  return cluster.members[(current + 1 + cluster.members.length) % cluster.members.length];
}

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
        if (item.preserveOffset) {
          const origin = pointAlong(before.coordinates, fraction);
          point[0] += node.point[0] - origin[0]; point[1] += node.point[1] - origin[1];
        }
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

/** Explicit graph selections start at their displayed position, overriding linked propagation once. */
export function translateSelection(spines: Spine[], graph: NavigationGraph | undefined, nodeMoves: NodeMoves, sourceIds: Set<string>, graphIds: Set<string>, delta: Point, grid = 0) {
  if (!delta.every(Number.isFinite)) return { spines, nodeMoves };
  const offset = delta.map(value => grid > 0 ? Math.round(value / grid) * grid : value) as Point;
  if (offset.every(value => value === 0)) return { spines, nodeMoves };
  const nextMoves = { ...nodeMoves };
  for (const node of graph?.nodes || []) {
    if (graphIds.has(node.id)) nextMoves[node.id] = [node.point[0] + offset[0], node.point[1] + offset[1]];
  }
  return { spines: translate(spines, sourceIds, offset), nodeMoves: nextMoves };
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
    : x >= left && x <= right && y >= top && y <= bottom).map(n => n.id);
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
  const config = structuredClone(session.config) as Record<string, unknown> & { reviewedSpineOverrides?: { spineIndex: number; coordinates: Point[]; id: string; sourceReferences: string[]; note: string }[]; reviewedConnections?: { id: string; coordinates: Point[]; sourceReferences?: string[]; note?: string }[] };
  if (config.reviewedConnections) config.reviewedConnections = config.reviewedConnections.filter(c => spines.some(s => s.id === 'connection:' + c.id));
  for (const spine of spines) {
    if (JSON.stringify(spine.coordinates) === JSON.stringify(session.spines.find(s => s.id === spine.id)?.coordinates)) continue;
    if (spine.kind === 'connection') {
      const connections = config.reviewedConnections ??= [];
      const target = connections.find(c => 'connection:' + c.id === spine.id);
      if (target) target.coordinates = spine.coordinates;
      else connections.push({ id: spine.id.slice(11), coordinates: spine.coordinates, sourceReferences: spine.sourceReferences, note: spine.note });
    } else {
      const overrides = config.reviewedSpineOverrides ??= [];
      const target = overrides.find(o => o.spineIndex === spine.index);
      if (target) target.coordinates = spine.coordinates;
      else overrides.push({ spineIndex: spine.index, coordinates: spine.coordinates, id: `admin-spine-${spine.index}`, sourceReferences: spine.sourceReferences, note: 'Administrator-edited diagnostic candidate; requires reconstruction and validation.' });
    }
  }
  return config;
}
