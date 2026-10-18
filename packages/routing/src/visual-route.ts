import type { NavigationGraph, Point } from '@wayfinding/map-engine';
import { createPolylineValidator, validConstraints } from './geometry-safety';

export interface CornerDiagnostic {
  sourceIndex: number;
  point: Point;
  angleDegrees: number;
  effectiveAngleDegrees: number;
  requestedRadius: number;
  availableRadius: number;
  acceptedRadius: number;
  applied: boolean;
  protected: boolean;
  protectionReason?: string;
  rejectedCandidates: number;
  reason: string;
}

export interface SmoothingOptions {
  /** Maximum tangent trim distance in SVG drawing units (not metres). */
  radius?: number;
  minRadius?: number;
  /** Must be below 0.5 so consecutive turns retain a straight connector. */
  segmentFraction?: number;
  maxSegmentLength?: number;
  maxDeviation?: number;
  minTurnDegrees?: number;
  maxTurnDegrees?: number;
  attempts?: number;
  /** Maximum deviation when removing small corridor zigzags, in drawing units. */
  simplifyTolerance?: number;
  /** Additional source vertex indices that must remain exact. */
  protectedIndices?: readonly number[];
  /** Opt-in QA instrumentation; never logs or attaches diagnostics in the UI. */
  onDiagnostics?: (corners: readonly CornerDiagnostic[]) => void;
}

export const smoothingDefaults = {
  radius: 48, minRadius: 0.5, segmentFraction: 0.48,
  maxSegmentLength: 1, maxDeviation: 0.05,
  minTurnDegrees: 2, maxTurnDegrees: 165, attempts: 16, simplifyTolerance: 2,
} as const;

export interface VisualRoute {
  points: Point[];
  /** Original drawing-distance station at each visual sample, for playback. */
  sourceDistances: number[];
  sourceLength: number;
}

const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const copy = (p: Point): Point => [p[0], p[1]];
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const equal = (a: Point, b: Point) => distance(a, b) <= 1e-7;

/**
 * Prepare once per immutable floor graph. Own a detached snapshot so validation
 * and anchor metadata cannot drift apart if the caller later mutates its graph.
 * Missing enclosure evidence disables smoothing rather than assuming free space.
 */
export function createRouteSmoother(input: NavigationGraph) {
  const graph = structuredClone(input);
  const enabled = validConstraints(graph) && graph.navigableAreas.length > 0;
  const safe = enabled ? createPolylineValidator(graph) : () => false;
  const incident = new Map<string, NavigationGraph['edges']>();
  for (const edge of graph.edges) {
    for (const id of [edge.from, edge.to]) incident.set(id, [...(incident.get(id) ?? []), edge]);
  }
  const anchors = [
    ...graph.nodes.flatMap(node => {
      const edges = incident.get(node.id) ?? [];
      const reason = node.type !== 'junction' ? node.type : node.roomId ? 'room-approach'
        : new Set(edges.map(edge => edge.accessibility)).size > 1 ? 'accessibility-transition'
          : new Set(edges.map(edge => edge.restriction)).size > 1 ? 'restriction-transition'
            : new Set(edges.map(edge => edge.floorId)).size > 1 ? 'floor-transition' : undefined;
      return reason ? [{ point: node.point, reason }] : [];
    }),
    ...graph.edges.filter(edge => edge.pathType !== 'corridor')
      .flatMap(edge => edge.geometry.map(point => ({ point, reason: `${edge.pathType}-transition` }))),
  ];

  return (source: readonly Point[], options: SmoothingOptions = {}): VisualRoute => {
    if (!source.every(p => p.length === 2 && p.every(Number.isFinite))) {
      return { points: [], sourceDistances: [], sourceLength: 0 };
    }
    let length = 0;
    const original: VisualRoute = {
      points: source.map(copy),
      sourceDistances: source.map((point, i) => {
        if (i) length += distance(source[i - 1], point);
        return length;
      }),
      sourceLength: 0,
    };
    original.sourceLength = length;
    if (!Number.isFinite(length)) return { points: [], sourceDistances: [], sourceLength: 0 };
    if (source.length < 3 || !enabled || !safe(original.points)) return original;
    const config = { ...smoothingDefaults, ...options };
    for (const key of Object.keys(smoothingDefaults) as (keyof typeof smoothingDefaults)[]) {
      if (!Number.isFinite(config[key]) || config[key] <= 0) return original;
    }
    if (config.segmentFraction >= 0.5 || config.maxTurnDegrees >= 180
      || config.minTurnDegrees >= config.maxTurnDegrees || config.minRadius > config.radius) return original;
    const protectedIndices = new Set(options.protectedIndices);
    const diagnostics: CornerDiagnostic[] = [];
    const vertices: { point: Point; station: number; locked: boolean; sourceIndex: number; protectionReason?: string }[] = [];
    source.forEach((point, index) => {
      const protectionReason = protectedIndices.has(index) ? 'explicit-anchor'
        : anchors.find(anchor => equal(anchor.point, point))?.reason;
      const locked = !!protectionReason;
      const previous = vertices.at(-1);
      // Remove exact duplicates only; tiny nonzero segments still carry distance.
      if (previous && distance(previous.point, point) === 0) {
        previous.locked ||= locked;
        previous.protectionReason ??= protectionReason;
      } else vertices.push({ point, station: original.sourceDistances[index], locked, sourceIndex: index, protectionReason });
    });
    const turn = (a: Point, b: Point, c: Point) => {
      const ab = distance(a, b), bc = distance(b, c);
      return Math.acos(Math.max(-1, Math.min(1,
        ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (ab * bc),
      ))) * 180 / Math.PI;
    };
    const originalAngles = new Map(vertices.slice(1, -1).map((vertex, index) =>
      [vertex.sourceIndex, turn(vertices[index].point, vertex.point, vertices[index + 2].point)]));
    // Bound deviation against the entire original subchain, so repeated removals
    // cannot accumulate into a wide shortcut. Preserve order and exact anchors.
    const canSimplify = (a: typeof vertices[number], b: typeof vertices[number], c: typeof vertices[number]) => {
      if (b.locked || turn(a.point, b.point, c.point) > config.maxTurnDegrees) return false;
      const span = distance(a.point, c.point);
      if (!span) return false;
      const dx = (c.point[0] - a.point[0]) / span, dy = (c.point[1] - a.point[1]) / span;
      let previousProjection = 0;
      let maximumDeviation = 0;
      for (let j = a.sourceIndex + 1; j < c.sourceIndex; j++) {
        const x = source[j][0] - a.point[0], y = source[j][1] - a.point[1];
        const projection = x * dx + y * dy;
        if (projection < previousProjection || projection > span
          || Math.abs(x * dy - y * dx) > config.simplifyTolerance) return false;
        previousProjection = projection;
        maximumDeviation = Math.max(maximumDeviation, Math.abs(x * dy - y * dx));
      }
      // Do not flatten genuine small turns or near-reversals simply because
      // the entire route happens to fit inside the simplification tolerance.
      return (span > config.simplifyTolerance * 4 || maximumDeviation <= 1e-7) && safe([a.point, c.point]);
    };
    for (let i = 1; i < vertices.length - 1;) {
      const [a, b, c] = vertices.slice(i - 1, i + 2);
      if (canSimplify(a, b, c)) {
        if (options.onDiagnostics) diagnostics.push({
          sourceIndex: b.sourceIndex, point: copy(b.point), angleDegrees: originalAngles.get(b.sourceIndex)!,
          effectiveAngleDegrees: turn(a.point, b.point, c.point),
          requestedRadius: config.radius, availableRadius: 0, acceptedRadius: 0,
          applied: false, protected: false, rejectedCandidates: 0, reason: 'safe-simplification',
        });
        vertices.splice(i, 1);
        i = Math.max(1, i - 1);
      } else i++;
    }
    const result: VisualRoute = { points: [], sourceDistances: [], sourceLength: length };
    const append = (point: Point, station: number) => {
      result.points.push(copy(point));
      result.sourceDistances.push(station);
    };
    append(vertices[0].point, 0);
    for (let i = 1; i < vertices.length - 1; i++) {
      const [a, b, c] = vertices.slice(i - 1, i + 2);
      const angle = turn(a.point, b.point, c.point);
      const before = distance(a.point, b.point), after = distance(b.point, c.point);
      const diagnostic: CornerDiagnostic = {
        sourceIndex: b.sourceIndex, point: copy(b.point), angleDegrees: originalAngles.get(b.sourceIndex)!,
        effectiveAngleDegrees: angle,
        requestedRadius: config.radius,
        availableRadius: Math.min(config.radius, before * config.segmentFraction, after * config.segmentFraction),
        acceptedRadius: 0, applied: false, protected: b.locked, rejectedCandidates: 0,
        protectionReason: b.protectionReason,
        reason: b.locked ? 'protected-anchor' : angle > config.maxTurnDegrees ? 'near-reversal'
          : angle < config.minTurnDegrees ? 'near-collinear' : 'below-minimum',
      };
      let accepted = false;
      if (!b.locked && angle >= config.minTurnDegrees && angle <= config.maxTurnDegrees) {
        let radius = diagnostic.availableRadius;
        let upper = radius, lower = 0;
        let best: { curve: Point[]; radius: number } | undefined;
        for (let attempt = 0; attempt < Math.min(32, config.attempts) && radius >= config.minRadius; attempt++) {
          const entry = lerp(b.point, a.point, radius / before);
          const exit = lerp(b.point, c.point, radius / after);
          // Quadratic chord-error bound is |entry - 2*control + exit|/(4*n^2).
          const curvature = Math.hypot(entry[0] - 2 * b.point[0] + exit[0], entry[1] - 2 * b.point[1] + exit[1]);
          const count = Math.max(8, Math.ceil(2 * radius / config.maxSegmentLength),
            Math.ceil(Math.sqrt(curvature / (4 * config.maxDeviation))));
          const curve = count > 512 ? [] : Array.from({ length: count + 1 }, (_, j) => {
            const t = j / count;
            return lerp(lerp(entry, b.point, t), lerp(b.point, exit, t), t);
          });
          // Validate the actual rendered chords, including both retained connectors.
          if (!curve.length || !safe([result.points.at(-1)!, ...curve, c.point])) {
            if (curve.length) diagnostic.rejectedCandidates++;
            diagnostic.reason = curve.length ? 'unsafe-geometry' : 'sampling-limit';
            upper = radius;
          } else {
            best = { curve, radius };
            lower = radius;
            if (radius === diagnostic.availableRadius) break;
          }
          // First find a safe lower bound, then recover the space lost by halving.
          // Only explicitly validated candidates can become the retained best.
          if (upper - lower < 0.1 || upper <= config.minRadius) break;
          radius = lower ? (lower + upper) / 2 : Math.max(config.minRadius, radius / 2);
        }
        if (best) {
          const { curve, radius } = best;
          const start = b.station - (b.station - a.station) * radius / before;
          const end = b.station + (c.station - b.station) * radius / after;
          curve.forEach((point, j) => append(point, start + (end - start) * j / (curve.length - 1)));
          accepted = true;
          diagnostic.applied = true;
          diagnostic.acceptedRadius = radius;
          diagnostic.reason = 'rounded';
        }
      }
      if (!accepted) append(b.point, b.station);
      if (options.onDiagnostics) diagnostics.push(diagnostic);
    }
    if (vertices.length > 1) append(vertices.at(-1)!.point, length);
    // Final joined geometry is authoritative for display safety, never for routing.
    const valid = safe(result.points);
    if (!valid) diagnostics.forEach(d => { d.applied = false; d.acceptedRadius = 0; d.reason = 'final-validation'; });
    options.onDiagnostics?.(diagnostics.sort((a, b) => a.sourceIndex - b.sourceIndex));
    return valid ? result : original;
  };
}
