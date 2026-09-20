import type {
  InstructionType, Localized, NavigationEdge, NavigationGraph, NavigationNode,
  Point, RouteInstruction, RouteResult,
} from '@wayfinding/map-engine';
import { createPolylineValidator, safePolyline, validConstraints } from './geometry-safety';

type Unit = RouteResult['distanceUnit'];
type Step = { edge: NavigationEdge; from: NavigationNode; to: NavigationNode; points: Point[]; cost: number };
type Prepared = { nodes: Map<string, NavigationNode>; adjacency: Map<string, Step[]>; unit: Unit };
const EPSILON = 1e-7;
const supported = (graph: NavigationGraph, status: NavigationNode['status']) => status === 'confirmed' || (graph.routingPolicy === 'drawing-based' && status === 'candidate');
// Content signatures invalidate on mutation; preparations own detached snapshots.
const preparedCache = new WeakMap<NavigationGraph, { signature: string; values: Map<boolean, Prepared | null> }>();
const validPoint = (point: Point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
const equalPoint = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPSILON;
const calibrated = (graph: NavigationGraph) => graph.calibrationStatus === 'confirmed'
  && graph.metersPerUnit !== null && Number.isFinite(graph.metersPerUnit) && graph.metersPerUnit > 0;

/** Drawing length only. A scale must be confirmed separately before calling it meters. */
export function polylineLength(points: Point[]): number {
  if (!points.every(validPoint)) return Number.NaN;
  return points.slice(1).reduce((length, point, i) => length + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);
}

const messages = {
  start: { en: 'The starting point or kiosk location has not been confirmed. Choose a confirmed starting point.', ar: 'لم يتم تأكيد نقطة البداية أو موقع الكشك. اختر نقطة بداية مؤكدة.' },
  destination: { en: 'The destination has no confirmed navigation point.', ar: 'لا توجد نقطة ملاحة مؤكدة للوجهة.' },
  unconfirmed: { en: 'Navigation connections have not been confirmed. Directions are unavailable until the map is verified.', ar: 'لم يتم تأكيد وصلات الملاحة. لن تتوفر الاتجاهات حتى يتم التحقق من الخريطة.' },
  missing: { en: 'The selected navigation point does not exist in this map.', ar: 'نقطة الملاحة المحددة غير موجودة في هذه الخريطة.' },
  invalid: { en: 'Navigation data contains invalid geometry, distances, or calibration. A verified route cannot be calculated.', ar: 'تحتوي بيانات الملاحة على هندسة أو مسافات أو معايرة غير صالحة. لا يمكن حساب مسار موثوق.' },
  disconnected: { en: 'No confirmed open route connects these points.', ar: 'لا يوجد مسار مفتوح ومؤكد يربط بين هاتين النقطتين.' },
  accessible: { en: 'No route with confirmed step-free accessibility connects these points.', ar: 'لا يوجد مسار مؤكد الإتاحة وخالٍ من الدرج يربط بين هاتين النقطتين.' },
} satisfies Record<string, Localized>;

function failure(status: Exclude<RouteResult['status'], 'ok'>, reason: Localized, unit: Unit): RouteResult {
  return { status, reason, nodeIds: [], edgeIds: [], points: [], distance: 0, distanceUnit: unit, instructions: [] };
}

function prepare(input: NavigationGraph, accessibleOnly = false): Prepared | null {
  let signature: string;
  try { signature = JSON.stringify(input, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? { invalidNumber: String(value) } : value); } catch { return null; }
  let cached = preparedCache.get(input);
  if (!cached || cached.signature !== signature) { cached = { signature, values: new Map() }; preparedCache.set(input, cached); }
  if (cached.values.has(accessibleOnly)) return cached.values.get(accessibleOnly)!;
  const prepared = prepareSnapshot(structuredClone(input), accessibleOnly);
  cached.values.set(accessibleOnly, prepared);
  return prepared;
}

function prepareSnapshot(graph: NavigationGraph, accessibleOnly: boolean): Prepared | null {
  if (graph.routingPolicy !== undefined && !['verified-only', 'drawing-based'].includes(graph.routingPolicy)) return null;
  const drawing = graph.routingPolicy === 'drawing-based';
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null;
  if (!validConstraints(graph)) return null;
  const safe = createPolylineValidator(graph);
  if (graph.calibrationStatus === 'confirmed' && !calibrated(graph)) return null;
  const unit: Unit = calibrated(graph) ? 'meter' : 'map-unit';
  const nodes = new Map<string, NavigationNode>();
  const adjacency = new Map<string, Step[]>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) return null;
    if (supported(graph, node.status) && !validPoint(node.point)) return null;
    nodes.set(node.id, node);
    adjacency.set(node.id, []);
  }
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (ids.has(edge.id)) return null;
    ids.add(edge.id);
    // Neither evidence status nor directory visibility implies physical access.
    if (!supported(graph, edge.status) || (drawing ? !['open', 'unknown'].includes(edge.restriction) : edge.restriction !== 'open')) continue;
    const from = nodes.get(edge.from), to = nodes.get(edge.to);
    if (!from || !to) return null;
    if (!supported(graph, from.status) || !supported(graph, to.status)) continue;
    if (!Number.isFinite(edge.distance) || edge.distance < 0) return null;
    if (edge.distanceUnit !== 'map-unit' && edge.distanceUnit !== 'meter') return null;
    // Never add meters and drawing units, or infer a physical scale from a route.
    if (edge.distanceUnit === 'meter' && unit !== 'meter') return null;
    if (!Array.isArray(edge.geometry) || edge.geometry.length < 2 || !edge.geometry.every(validPoint)) return null;
    if (!equalPoint(edge.geometry[0], from.point) || !equalPoint(edge.geometry[edge.geometry.length - 1], to.point)) return null;
    const vertical = from.floorId !== to.floorId;
    if (vertical && edge.pathType !== 'stairs' && edge.pathType !== 'elevator') return null;
    if (!vertical && edge.floorId !== from.floorId) return null;
    if (vertical && edge.floorId !== from.floorId && edge.floorId !== to.floorId) return null;
    if (from.buildingId !== to.buildingId) return null;
    if (!safe(edge.geometry)) return null;
    if (drawing && !vertical) {
      const length = polylineLength(edge.geometry) * (edge.distanceUnit === 'meter' ? graph.metersPerUnit! : 1);
      if (length <= 0 || Math.abs(edge.distance - length) > Math.max(.01, length * 1e-5)) return null;
    }
    if (accessibleOnly && (edge.accessibility !== 'confirmed' || edge.pathType === 'stairs')) continue;
    // Distances are validated graph weights. Vertical costs need not equal the 2D polyline length.
    const cost = edge.distanceUnit === 'map-unit' && unit === 'meter'
      ? edge.distance * graph.metersPerUnit! : edge.distance;
    if (!Number.isFinite(cost)) return null;
    adjacency.get(from.id)!.push({ edge, from, to, cost, points: edge.geometry });
    if (edge.bidirectional) adjacency.get(to.id)!.push({ edge, from: to, to: from, cost, points: [...edge.geometry].reverse() });
  }
  return { nodes, adjacency, unit };
}

/** A* with h=0: admissible even across floors, zero-cost edges, and mixed calibrated units. */
export function findRoute(
  graph: NavigationGraph,
  startId: string | null,
  endId: string | null,
  options: { accessibleOnly?: boolean } = {},
): RouteResult {
  const unit: Unit = calibrated(graph) ? 'meter' : 'map-unit';
  if (startId === null) return failure('unavailable', messages.start, unit);
  if (endId === null) return failure('unavailable', messages.destination, unit);
  const prepared = prepare(graph, options.accessibleOnly);
  if (!prepared) return failure('invalid', messages.invalid, unit);
  const start = prepared.nodes.get(startId), end = prepared.nodes.get(endId);
  if (!start || !end) return graph.status === 'confirmed'
    ? failure('invalid', messages.missing, unit) : failure('unconfirmed', messages.unconfirmed, unit);
  if (!supported(graph, start.status) || !supported(graph, end.status)) return failure('unconfirmed', messages.unconfirmed, unit);
  if (!safePolyline([start.point, start.point], graph) || !safePolyline([end.point, end.point], graph)) return failure('invalid', messages.invalid, unit);
  const distances = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, Step>();
  const open = new Set([startId]);
  const settled = new Set<string>();
  while (open.size) {
    let current: string | undefined;
    for (const id of open) if (current === undefined || distances.get(id)! < distances.get(current)!) current = id;
    if (current === endId) break;
    open.delete(current!);
    settled.add(current!);
    for (const step of prepared.adjacency.get(current!)!) {
      if (settled.has(step.to.id)) continue;
      const distance = distances.get(current!)! + step.cost;
      if (!Number.isFinite(distance)) continue;
      if (distance < (distances.get(step.to.id) ?? Infinity)) {
        distances.set(step.to.id, distance);
        previous.set(step.to.id, step);
        open.add(step.to.id);
      }
    }
  }
  if (!distances.has(endId)) return graph.routingPolicy !== 'drawing-based' && graph.status !== 'confirmed' && !options.accessibleOnly
    ? failure('unconfirmed', messages.unconfirmed, unit)
    : failure('unavailable', options.accessibleOnly ? messages.accessible : messages.disconnected, unit);
  const steps: Step[] = [];
  for (let cursor = endId; cursor !== startId;) {
    const step = previous.get(cursor)!;
    steps.push(step);
    cursor = step.from.id;
  }
  steps.reverse();
  const nodeIds = [startId, ...steps.map(step => step.to.id)];
  const edgeIds = steps.map(step => step.edge.id);
  const points: Point[] = [];
  for (const point of steps.length ? steps.flatMap(step => step.points) : [start.point]) {
    if (!points.length || !equalPoint(points[points.length - 1], point)) points.push([...point]);
  }
  return { status: 'ok', reason: null, nodeIds, edgeIds, points, distance: distances.get(endId)!, distanceUnit: unit,
    instructions: instructionsFor(steps, start, unit) };
}

const instructionText: Record<InstructionType, Localized> = {
  start: { en: 'Start here and follow the route.', ar: 'ابدأ من هنا واتبع المسار.' },
  continue: { en: 'Continue straight.', ar: 'تابع السير مباشرة.' },
  'slight-left': { en: 'Bear slightly left.', ar: 'اتجه قليلاً إلى اليسار.' },
  'slight-right': { en: 'Bear slightly right.', ar: 'اتجه قليلاً إلى اليمين.' },
  left: { en: 'Turn left.', ar: 'انعطف يساراً.' },
  right: { en: 'Turn right.', ar: 'انعطف يميناً.' },
  'enter-corridor': { en: 'Enter the corridor.', ar: 'ادخل الممر.' },
  stairs: { en: 'Take the stairs.', ar: 'استخدم الدرج.' },
  elevator: { en: 'Take the elevator.', ar: 'استخدم المصعد.' },
  'destination-left': { en: 'Your destination is on the left.', ar: 'وجهتك على اليسار.' },
  'destination-right': { en: 'Your destination is on the right.', ar: 'وجهتك على اليمين.' },
  arrival: { en: 'You have arrived at your destination.', ar: 'لقد وصلت إلى وجهتك.' },
};

type Vector = Point;
function vectors(points: Point[]): Vector[] {
  return points.slice(1).map((point, i): Vector => [point[0] - points[i][0], point[1] - points[i][1]])
    .filter(vector => Math.hypot(...vector) > EPSILON);
}

/** SVG coordinates: positive cross product is a clockwise/right turn. Boundaries: 15° / 45°. */
function turn(incoming: Vector, outgoing: Vector): InstructionType {
  const angle = Math.atan2(incoming[0] * outgoing[1] - incoming[1] * outgoing[0],
    incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) * 180 / Math.PI;
  if (Math.abs(angle) < 15 - EPSILON) return 'continue';
  if (Math.abs(angle) < 45 - EPSILON) return angle < 0 ? 'slight-left' : 'slight-right';
  return angle < 0 ? 'left' : 'right';
}

function instructionsFor(steps: Step[], start: NavigationNode, unit: Unit): RouteInstruction[] {
  const output: RouteInstruction[] = [];
  const add = (type: InstructionType, nodeId: string, distance: number | null = null, text = instructionText[type]) => {
    const previous = output.at(-1);
    if (type === 'continue' && previous?.type === 'continue') {
      previous.distance = (previous.distance ?? 0) + (distance ?? 0);
      return;
    }
    output.push({ type, nodeId, distance, distanceUnit: unit, text: { ...text } });
  };
  add('start', start.id, steps[0]?.cost ?? 0);
  let incoming: Vector | undefined;
  steps.forEach((step, index) => {
    const segments = vectors(step.points);
    const vertical = step.edge.pathType === 'stairs' || step.edge.pathType === 'elevator';
    if (vertical) {
      const action = instructionText[step.edge.pathType as 'stairs' | 'elevator'];
      const text = step.from.floorId === step.to.floorId ? action : {
        en: `${action.en.replace(/\.$/, '')} to floor ${step.to.floorId}.`,
        ar: `${action.ar.replace(/\.$/, '')} إلى الطابق ${step.to.floorId}.`,
      };
      add(step.edge.pathType as 'stairs' | 'elevator', step.from.id, step.cost, text);
      incoming = undefined; // A new floor has no established facing direction.
      return;
    }
    const direction = incoming && segments[0] ? turn(incoming, segments[0]) : 'continue';
    const finalDoor = index === steps.length - 1 && step.edge.pathType === 'door'
      && (step.to.type === 'door' || step.to.roomId !== undefined);
    if (finalDoor && direction !== 'continue') {
      add(direction.includes('left') ? 'destination-left' : 'destination-right', step.to.id, step.cost);
    } else {
      if (index > 0 && incoming) add(direction, step.from.id, step.cost);
      else if (index > 0) add('continue', step.from.id, step.cost);
      if (step.edge.pathType === 'corridor' && (step.from.type === 'door' || step.from.type === 'entrance'
        || (index > 0 && ['door', 'entrance'].includes(steps[index - 1].edge.pathType)))) add('enter-corridor', step.from.id);
    }
    // Preserve bends inside an edge; omitting them would tell visitors to walk through a corner.
    for (let i = 1; i < segments.length; i++) {
      const bend = turn(segments[i - 1], segments[i]);
      if (bend !== 'continue') add(bend, step.from.id);
    }
    if (segments.length) incoming = segments[segments.length - 1];
  });
  add('arrival', steps.at(-1)?.to.id ?? start.id, 0);
  return output;
}

/** Instructions accept only a contiguous path allowed by the explicit routing policy. */
export function generateInstructions(graph: NavigationGraph, nodeIds: string[], edgeIds: string[]): RouteInstruction[] {
  if (!nodeIds.length || nodeIds.length !== edgeIds.length + 1) return [];
  const prepared = prepare(graph);
  if (!prepared) return [];
  const start = prepared.nodes.get(nodeIds[0]);
  if (!start || !supported(graph, start.status)) return [];
  if (!safePolyline([start.point, start.point], graph)) return [];
  const steps: Step[] = [];
  for (let i = 0; i < edgeIds.length; i++) {
    const step = prepared.adjacency.get(nodeIds[i])?.find(item => item.edge.id === edgeIds[i] && item.to.id === nodeIds[i + 1]);
    if (!step) return [];
    steps.push(step);
  }
  return instructionsFor(steps, start, prepared.unit);
}
