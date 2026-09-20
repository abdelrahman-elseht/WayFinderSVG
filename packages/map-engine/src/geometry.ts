import type { Point } from './types';

/** Signed area in drawing units squared; screen y increases downward. */
export function polygonArea(polygon: readonly Point[]): number {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return twice / 2;
}

/** Boundary-inclusive point containment. Null geometry is never inferred. */
export function pointInPolygon(point: Point, polygon: readonly Point[] | null): boolean {
  if (!polygon || polygon.length < 3 || !point.every(Number.isFinite)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) <= 1e-8 && point[0] >= Math.min(a[0], b[0]) - 1e-8 && point[0] <= Math.max(a[0], b[0]) + 1e-8 && point[1] >= Math.min(a[1], b[1]) - 1e-8 && point[1] <= Math.max(a[1], b[1]) + 1e-8) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function polygonBounds(polygon: readonly Point[]): [number, number, number, number] | null {
  if (!polygon.length) return null;
  const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
