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

    // Fit connected cubic pieces over runs of corridor turns. Each piece has
    // explicit endpoint tangents, so the turn entry, inter-turn connector and
    // turn exit share the same direction (C1 continuity). This is a visual
    // candidate only; every rendered chord is still checked by `safe`.
    const cubic = (p0: Point, p1: Point, p2: Point, p3: Point, count: number): Point[] => {
      const points: Point[] = [];
      for (let index = 0; index <= count; index++) {
        const t = index / count, u = 1 - t;
        points.push([
          u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0],
          u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1],
        ]);
      }
      return points;
    };
    const unit = (a: Point, b: Point): Point => {
      const length = distance(a, b);
      return length ? [(b[0] - a[0]) / length, (b[1] - a[1]) / length] : [0, 0];
    };
    const grouped: VisualRoute = { points: [], sourceDistances: [], sourceLength: length };
    const appendGrouped = (point: Point, station: number) => {
      const previous = grouped.points.at(-1);
      if (previous && equal(previous, point)) return;
      grouped.points.push(copy(point));
      const previousStation = grouped.sourceDistances.at(-1);
      grouped.sourceDistances.push(previousStation === undefined ? station : Math.max(station, previousStation + 1e-9));
    };
    let groupedApplied = false;
    for (let start = 1; start < vertices.length - 1;) {
      const first = vertices[start];
      const firstAngle = turn(vertices[start - 1].point, first.point, vertices[start + 1].point);
      if (first.locked || firstAngle < config.minTurnDegrees || firstAngle > config.maxTurnDegrees) { start++; continue; }
      let end = start;
      while (end + 1 < vertices.length - 1) {
        const vertex = vertices[end + 1];
        const angle = turn(vertices[end].point, vertex.point, vertices[end + 2].point);
        if (vertex.locked || angle < config.minTurnDegrees || angle > config.maxTurnDegrees) break;
        end++;
      }
      if (end === start) { start++; continue; }
      const entries: Point[] = [], exits: Point[] = [];
      for (let index = start; index <= end; index++) {
        const before = distance(vertices[index - 1].point, vertices[index].point);
        const after = distance(vertices[index].point, vertices[index + 1].point);
        const radius = Math.min(config.radius, before * config.segmentFraction, after * config.segmentFraction);
        if (radius < config.minRadius) { entries.length = 0; break; }
        entries.push(lerp(vertices[index].point, vertices[index - 1].point, radius / before));
        exits.push(lerp(vertices[index].point, vertices[index + 1].point, radius / after));
      }
      if (!entries.length) { start = end + 1; continue; }
      const candidate: VisualRoute = { points: [], sourceDistances: [], sourceLength: length };
      const append = (point: Point, station: number) => {
        const previous = candidate.points.at(-1);
        if (previous && equal(previous, point)) return;
        const previousStation = candidate.sourceDistances.at(-1);
        candidate.points.push(copy(point));
        candidate.sourceDistances.push(previousStation === undefined ? station : Math.max(station, previousStation + 1e-9));
      };
      append(vertices[start - 1].point, vertices[start - 1].station);
      for (let index = 0; index < entries.length; index++) {
        const vertex = vertices[start + index];
        const before = vertices[start + index - 1].point;
        const after = vertices[start + index + 1].point;
        const entry = entries[index], exit = exits[index];
        const incoming = unit(before, entry), outgoing = unit(exit, after);
        const turnChord = distance(entry, exit);
        const handle = Math.min(turnChord / 3, config.radius * 0.8);
        const curve = cubic(entry, [entry[0] + incoming[0] * handle, entry[1] + incoming[1] * handle],
          [exit[0] - outgoing[0] * handle, exit[1] - outgoing[1] * handle], exit,
          Math.max(8, Math.ceil(turnChord / config.maxSegmentLength)));
        const entryStation = vertex.station - (vertex.station - vertices[start + index - 1].station)
          * distance(vertex.point, entry) / distance(vertex.point, before);
        const exitStation = vertex.station + (vertices[start + index + 1].station - vertex.station)
          * distance(vertex.point, exit) / distance(vertex.point, after);
        curve.forEach((point, sample) => append(point, entryStation + (exitStation - entryStation) * sample / (curve.length - 1)));
        if (index + 1 < entries.length) {
          const nextEntry = entries[index + 1], connectorLength = distance(exit, nextEntry);
          const connectorIn = unit(exit, nextEntry), connectorOut = unit(vertex.point, nextEntry);
          const connector = cubic(exit, [exit[0] + connectorIn[0] * connectorLength / 3, exit[1] + connectorIn[1] * connectorLength / 3],
            [nextEntry[0] - connectorOut[0] * connectorLength / 3, nextEntry[1] - connectorOut[1] * connectorLength / 3], nextEntry,
            Math.max(4, Math.ceil(connectorLength / config.maxSegmentLength)));
          const fromStation = exitStation;
          const nextVertex = vertices[start + index + 1];
          const nextStation = nextVertex.station - (nextVertex.station - vertex.station)
            * distance(nextVertex.point, nextEntry) / distance(nextVertex.point, vertex.point);
          connector.slice(1).forEach((point, sample) => append(point, fromStation + (nextStation - fromStation) * sample / (connector.length - 1)));
        }
      }
      append(vertices[end + 1].point, vertices[end + 1].station);
      // Prefer one broad sweep for the whole bending region. The offset is
      // intentionally modest and is retained only when the sampled curve is
      // fully contained by the existing visual safety validator.
      const sweepEntry = entries[0], sweepExit = exits.at(-1)!;
      const sweepIncoming = unit(vertices[start - 1].point, sweepEntry);
      const sweepOutgoing = unit(sweepExit, vertices[end + 1].point);
      const sweepChord = distance(sweepEntry, sweepExit);
      const signedBend = vertices.slice(start, end + 1).reduce((sum, vertex, index) => {
        const before = vertices[start + index - 1].point, after = vertices[start + index + 1].point;
        return sum + (after[0] - vertex.point[0]) * (vertex.point[1] - before[1])
          - (after[1] - vertex.point[1]) * (vertex.point[0] - before[0]);
      }, 0);
      const normal: Point = signedBend >= 0 ? [-sweepIncoming[1], sweepIncoming[0]] : [sweepIncoming[1], -sweepIncoming[0]];
      const sweepHandle = Math.min(sweepChord / 2, config.radius * 2.2);
      const sweepOffset = 0;
      const sweep = cubic(sweepEntry,
        [sweepEntry[0] + sweepIncoming[0] * sweepHandle + normal[0] * sweepOffset, sweepEntry[1] + sweepIncoming[1] * sweepHandle + normal[1] * sweepOffset],
        [sweepExit[0] - sweepOutgoing[0] * sweepHandle + normal[0] * sweepOffset, sweepExit[1] - sweepOutgoing[1] * sweepHandle + normal[1] * sweepOffset], sweepExit,
        Math.max(80, Math.ceil(sweepChord / config.maxSegmentLength)));
      const sweepCandidate: VisualRoute = { points: [], sourceDistances: [], sourceLength: length };
      const appendSweep = (point: Point, station: number) => {
        if (sweepCandidate.points.at(-1) && equal(sweepCandidate.points.at(-1)!, point)) return;
        const previousStation = sweepCandidate.sourceDistances.at(-1);
        sweepCandidate.points.push(copy(point));
        sweepCandidate.sourceDistances.push(previousStation === undefined ? station : Math.max(station, previousStation + 1e-9));
      };
      appendSweep(vertices[start - 1].point, vertices[start - 1].station);
      const sweepStartStation = vertices[start].station - (vertices[start].station - vertices[start - 1].station)
        * distance(vertices[start].point, sweepEntry) / distance(vertices[start].point, vertices[start - 1].point);
      const sweepEndStation = vertices[end].station + (vertices[end + 1].station - vertices[end].station)
        * distance(vertices[end].point, sweepExit) / distance(vertices[end].point, vertices[end + 1].point);
      sweep.forEach((point, index) => appendSweep(point, sweepStartStation + (sweepEndStation - sweepStartStation) * index / (sweep.length - 1)));
      appendSweep(vertices[end + 1].point, vertices[end + 1].station);
      if (safe(sweepCandidate.points)) {
        candidate.points.splice(0, candidate.points.length, ...sweepCandidate.points);
        candidate.sourceDistances.splice(0, candidate.sourceDistances.length, ...sweepCandidate.sourceDistances);
      }
      if (safe(candidate.points)) {
        // Keep all route geometry outside the grouped run as exact source
        // stations, then splice the validated visual candidate into it.
        groupedApplied = true;
        for (let index = 0; index < start - 1; index++) appendGrouped(vertices[index].point, vertices[index].station);
        appendGrouped(candidate.points[0], candidate.sourceDistances[0]);
        candidate.points.slice(1).forEach((point, index) => appendGrouped(point, candidate.sourceDistances[index + 1]));
        for (let index = end + 2; index < vertices.length; index++) appendGrouped(vertices[index].point, vertices[index].station);
      }
      start = end + 1;
      if (groupedApplied) break;
    }
    if (groupedApplied && safe(grouped.points)) return grouped;
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
