import type { NavigationGraph, Point } from '@wayfinding/map-engine';

// Drawing-coordinate tolerance, not a physical clearance or accessibility claim.
const TOLERANCE = 1e-7;
type Segment = [Point, Point];
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const validPoint = (point: Point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);

function onSegment(point: Point, a: Point, b: Point): boolean {
  const vector = subtract(b, a), offset = subtract(point, a);
  const length = Math.hypot(...vector);
  if (length === 0) return Math.hypot(...offset) <= TOLERANCE;
  return Math.abs(cross(vector, offset)) <= TOLERANCE * length
    && point[0] >= Math.min(a[0], b[0]) - TOLERANCE && point[0] <= Math.max(a[0], b[0]) + TOLERANCE
    && point[1] >= Math.min(a[1], b[1]) - TOLERANCE && point[1] <= Math.max(a[1], b[1]) + TOLERANCE;
}

/** Parameter values on ab at every intersection with cd, including collinear overlap. */
function intersections(a: Point, b: Point, c: Point, d: Point): number[] {
  const r = subtract(b, a), s = subtract(d, c), offset = subtract(c, a);
  const length = Math.hypot(...r), otherLength = Math.hypot(...s);
  if (length === 0) return onSegment(a, c, d) ? [0] : [];
  const denominator = cross(r, s);
  if (Math.abs(denominator) > Number.EPSILON * 16 * length * otherLength) {
    const t = cross(offset, s) / denominator, u = cross(offset, r) / denominator;
    return t >= -TOLERANCE / length && t <= 1 + TOLERANCE / length
      && u >= -TOLERANCE / otherLength && u <= 1 + TOLERANCE / otherLength
      ? [Math.max(0, Math.min(1, t))] : [];
  }
  if (Math.abs(cross(offset, r)) > TOLERANCE * length) return [];
  // Project onto the dominant axis to avoid a squared-length overflow.
  const axis = Math.abs(r[0]) >= Math.abs(r[1]) ? 0 : 1;
  const t0 = (c[axis] - a[axis]) / r[axis], t1 = (d[axis] - a[axis]) / r[axis];
  const low = Math.max(0, Math.min(t0, t1)), high = Math.min(1, Math.max(t0, t1));
  return low <= high + TOLERANCE / length ? [Math.max(0, Math.min(1, low)), Math.max(0, Math.min(1, high))] : [];
}

const boundaries = (polygon: Point[]): Segment[] => polygon.map((point, i) => [point, polygon[(i + 1) % polygon.length]]);

function contains(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (const [a, b] of boundaries(polygon)) {
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function validPolygon(polygon: Point[]): boolean {
  if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(validPoint)) return false;
  // Closed and open ring representations are both accepted; degenerate rings are not areas.
  const ring = polygon.length > 3 && Math.hypot(polygon[0][0] - polygon.at(-1)![0], polygon[0][1] - polygon.at(-1)![1]) <= TOLERANCE ? polygon.slice(0, -1) : polygon;
  const sides = boundaries(ring);
  for (let i = 0; i < sides.length; i++) {
    if (Math.hypot(sides[i][0][0] - sides[i][1][0], sides[i][0][1] - sides[i][1][1]) <= TOLERANCE) return false;
    for (let j = i + 1; j < sides.length; j++) {
      if (j === i + 1 || (i === 0 && j === sides.length - 1)) continue;
      if (intersections(...sides[i], ...sides[j]).length) return false;
    }
  }
  const area = boundaries(polygon).reduce((sum, [a, b]) => sum + cross(a, b), 0);
  return Number.isFinite(area) && Math.abs(area) > TOLERANCE * TOLERANCE;
}

export function validConstraints(graph: NavigationGraph): boolean {
  if (!Array.isArray(graph.walls) || !Array.isArray(graph.navigableAreas)) return false;
  if (!graph.walls.every(wall => Array.isArray(wall) && wall.length === 2 && wall.every(validPoint))
    || !graph.navigableAreas.every(validPolygon)) return false;
  if (graph.routingPolicy === 'drawing-based' && !graph.navigableAreas.length) return false;
  // The v1 graph has no floor association for obstacles/enclosures. Applying one floor's
  // polygons to another floor or projecting a stairway onto them would invent validation.
  return !(graph.walls.length || graph.navigableAreas.length)
    || new Set(graph.nodes.filter(node => node.status === 'confirmed' || (graph.routingPolicy === 'drawing-based' && node.status === 'candidate')).map(node => node.floorId)).size <= 1;
}

type Bounds = [number, number, number, number];
const bounds = (points: Point[]): Bounds => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const overlap = (a: Bounds, b: Bounds) => a[0] <= b[2] + TOLERANCE && b[0] <= a[2] + TOLERANCE && a[1] <= b[3] + TOLERANCE && b[1] <= a[3] + TOLERANCE;

/** Compile only for a detached snapshot, never retain a mutable caller's geometry. */
export function createPolylineValidator(graph: NavigationGraph): (points: Point[]) => boolean {
  const areas = graph.navigableAreas.map(polygon => ({ polygon, box: bounds(polygon) }));
  const walls = graph.walls.map(segment => ({ segment, box: bounds(segment) }));
  const polygonEdges = graph.navigableAreas.flatMap(boundaries).map(segment => ({ segment, box: bounds(segment) }));
  const insideUnion = (point: Point) => areas.some(({ polygon, box }) => overlap([point[0], point[1], point[0], point[1]], box) && contains(point, polygon));
  return (points: Point[]) => {
  if (graph.navigableAreas.length && !points.every(insideUnion)) return false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!Number.isFinite(Math.hypot(b[0] - a[0], b[1] - a[1]))) return false;
    // A door opening must be represented as a gap in supplied wall segments.
    const box = bounds([a, b]);
    if (walls.some(({ segment: [c, d], box: wallBox }) => overlap(box, wallBox) && intersections(a, b, c, d).length > 0)) return false;
    if (!graph.navigableAreas.length) continue;
    // Membership is constant between successive boundary intersections, including for
    // concave polygons, touching polygons and a union with several disconnected pieces.
    const cuts = [0, 1, ...polygonEdges.flatMap(({ segment: [c, d], box: edgeBox }) => overlap(box, edgeBox) ? intersections(a, b, c, d) : [])].sort((x, y) => x - y);
    for (let j = 1; j < cuts.length; j++) {
      if (cuts[j] === cuts[j - 1]) continue;
      const t = (cuts[j] + cuts[j - 1]) / 2;
      if (!insideUnion([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
    }
  }
  return true;
  };
}

export function safePolyline(points: Point[], graph: NavigationGraph): boolean {
  return createPolylineValidator(graph)(points);
}
