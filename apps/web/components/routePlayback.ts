import type { NavigationGraph, Point, RouteResult } from '@wayfinding/map-engine';
import type { VisualRoute } from '../../../packages/routing/src/visual-route';

/** Reveal cached geometry using original route distance, without rebuilding corners. */
export function clipVisualRouteAtProgress(route: VisualRoute, progress: number): Point[] {
  const normalized = clampProgress(progress);
  if (!route.points.length) return [];
  if (normalized === 1) return route.points;
  const target = normalized * route.sourceLength;
  const visible: Point[] = [route.points[0]];
  for (let i = 1; i < route.points.length; i++) {
    const from = route.sourceDistances[i - 1], to = route.sourceDistances[i];
    if (to <= target) {
      visible.push(route.points[i]);
      continue;
    }
    if (target > from && to > from) {
      const t = (target - from) / (to - from);
      const a = route.points[i - 1], b = route.points[i];
      visible.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    break;
  }
  return visible;
}

/** Lifecycle for the render-time route playback overlay. */
export type PlaybackPhase = 'idle' | 'ready' | 'playing' | 'paused' | 'complete' | 'stopped';

export interface RoutePlaybackState {
  phase: PlaybackPhase;
  /** Normalized arc-length progress. Always finite and in [0, 1]. */
  progress: number;
  /** Index of the instruction currently being presented. */
  instructionIndex: number;
  /** Whether the map may follow the active route point. */
  followCamera: boolean;
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Sum finite drawing-unit segments without mutating the source route. */
export function routeArcLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index][0] - points[index - 1][0];
    const dy = points[index][1] - points[index - 1][1];
    const length = Math.hypot(dx, dy);
    if (Number.isFinite(length)) total += length;
  }
  return total;
}

export interface PlaybackDurationOptions {
  /** Drawing units per millisecond. The default is intentionally kiosk-paced. */
  speed?: number;
  minMs?: number;
  maxMs?: number;
}

/** Calculate a deterministic, bounded duration from route distance. */
export function playbackDuration(points: readonly Point[], options: PlaybackDurationOptions = {}): number {
  const speed = Number.isFinite(options.speed) && (options.speed ?? 0) > 0 ? options.speed as number : 0.25;
  const minMs = Number.isFinite(options.minMs) ? Math.max(0, options.minMs as number) : 900;
  const maxMs = Number.isFinite(options.maxMs) ? Math.max(minMs, options.maxMs as number) : 9000;
  return Math.min(maxMs, Math.max(minMs, routeArcLength(points) / speed));
}

export type RoutePlaybackPart =
  | { kind: 'floor'; floorId: string; points: Point[]; duration: number }
  | { kind: 'transition'; floorId: string; points: Point[]; fromNodeId: string; duration: number };

export function routePlaybackPlan(graph: NavigationGraph, route: RouteResult): RoutePlaybackPart[] {
  if (route.status !== 'ok' || !route.nodeIds.length) return [];
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const first = nodes.get(route.nodeIds[0]);
  if (!first) return [];
  const parts: RoutePlaybackPart[] = [];
  let floorId = first.floorId;
  let points: Point[] = [[...first.point]];
  for (let index = 0; index < route.edgeIds.length; index += 1) {
    const edge = edges.get(route.edgeIds[index]);
    const from = nodes.get(route.nodeIds[index]);
    const to = nodes.get(route.nodeIds[index + 1]);
    if (!edge || !from || !to) return [];
    if (from.floorId !== to.floorId) {
      parts.push({ kind: 'floor', floorId, points, duration: points.length > 1 ? playbackDuration(points) : 0 });
      parts.push({ kind: 'transition', floorId: to.floorId, points: [[...to.point]], fromNodeId: from.id, duration: 1600 });
      floorId = to.floorId;
      points = [[...to.point]];
      continue;
    }
    const geometry = edge.from === from.id ? edge.geometry : [...edge.geometry].reverse();
    for (const point of geometry) {
      if (!points.length || points.at(-1)![0] !== point[0] || points.at(-1)![1] !== point[1]) points.push([...point]);
    }
  }
  parts.push({ kind: 'floor', floorId, points, duration: points.length > 1 ? playbackDuration(points) : 0 });
  return parts;
}

export function playbackPlanDuration(parts: readonly RoutePlaybackPart[]): number {
  return parts.reduce((total, part) => total + part.duration, 0);
}

export function playbackPlanPosition(parts: readonly RoutePlaybackPart[], progress: number) {
  if (!parts.length) return null;
  const duration = playbackPlanDuration(parts);
  let elapsed = clampProgress(progress) * duration;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.duration === 0) continue;
    if (elapsed < part.duration || index === parts.length - 1) {
      return { part, partProgress: clampProgress(elapsed / part.duration) };
    }
    elapsed -= part.duration;
  }
  const last = parts.at(-1)!;
  return { part: last, partProgress: 1 };
}

export function clampInstructionIndex(index: number, instructionCount: number): number {
  const count = Number.isFinite(instructionCount) ? Math.max(0, Math.floor(instructionCount)) : 0;
  if (count === 0) return 0;
  const value = Number.isFinite(index) ? Math.floor(index) : 0;
  return Math.min(count - 1, Math.max(0, value));
}

/**
 * Return the prefix of a route at normalized arc-length progress. The source
 * route is never mutated; repeated points and empty routes are safe inputs.
 */
export function clipRouteAtProgress(points: readonly Point[], progress: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [[points[0][0], points[0][1]]];

  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    const dx = point[0] - previous[0];
    const dy = point[1] - previous[1];
    return Number.isFinite(dx) && Number.isFinite(dy) ? Math.hypot(dx, dy) : 0;
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const normalized = clampProgress(progress);
  if (total <= 0) {
    return normalized >= 1 ? points.map(point => [point[0], point[1]]) : [[points[0][0], points[0][1]]];
  }
  if (normalized >= 1) return points.map(point => [point[0], point[1]]);

  const target = total * normalized;
  const visible: Point[] = [[points[0][0], points[0][1]]];
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    const from = points[index];
    const to = points[index + 1];
    if (segmentLength === 0) continue;
    if (target >= travelled + segmentLength) {
      visible.push([to[0], to[1]]);
      travelled += segmentLength;
      continue;
    }
    const ratio = Math.min(1, Math.max(0, (target - travelled) / segmentLength));
    const clipped: Point = [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    const previous = visible[visible.length - 1];
    if (previous[0] !== clipped[0] || previous[1] !== clipped[1]) visible.push(clipped);
    break;
  }
  return visible;
}

/** Alias kept short for map components and tests. */
export const clipRoute = clipRouteAtProgress;

/** Return the point at normalized arc-length progress, suitable for camera following. */
export function pointAtProgress(points: readonly Point[], progress: number): Point | null {
  if (!points.length) return null;
  if (points.length === 1) return [points[0][0], points[0][1]];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const total = lengths.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  if (!total) return [points[0][0], points[0][1]];
  const target = total * clampProgress(progress);
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const len = Number.isFinite(lengths[i]) ? lengths[i] : 0;
    if (target <= travelled + len && len > 0) {
      const ratio = (target - travelled) / len;
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * ratio, points[i][1] + (points[i + 1][1] - points[i][1]) * ratio];
    }
    travelled += len;
  }
  const last = points[points.length - 1];
  return [last[0], last[1]];
}

export function createPlaybackState(overrides: Partial<RoutePlaybackState> = {}): RoutePlaybackState {
  const state: RoutePlaybackState = {
    phase: 'idle',
    progress: 0,
    instructionIndex: 0,
    followCamera: false,
    ...overrides,
  };
  return {
    ...state,
    progress: clampProgress(state.progress),
    instructionIndex: Math.max(0, Math.floor(Number.isFinite(state.instructionIndex) ? state.instructionIndex : 0)),
  };
}
