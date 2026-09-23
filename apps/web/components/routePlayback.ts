import type { Point } from '@wayfinding/map-engine';

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
  const speed = Number.isFinite(options.speed) && (options.speed ?? 0) > 0 ? options.speed as number : 0.35;
  const minMs = Number.isFinite(options.minMs) ? Math.max(0, options.minMs as number) : 900;
  const maxMs = Number.isFinite(options.maxMs) ? Math.max(minMs, options.maxMs as number) : 6000;
  return Math.min(maxMs, Math.max(minMs, routeArcLength(points) / speed));
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
