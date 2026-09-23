import { describe, expect, it } from 'vitest';
import { clipRouteAtProgress, playbackDuration, routeArcLength } from '../../apps/web/components/routePlayback';

describe('route playback geometry and timing', () => {
  it('clips by arc length across uneven segments', () => {
    expect(clipRouteAtProgress([[0, 0], [10, 0], [10, 90]], .5)).toEqual([[0, 0], [10, 0], [10, 40]]);
  });

  it('handles repeated, empty, and two-point routes without NaN', () => {
    expect(clipRouteAtProgress([], .5)).toEqual([]);
    expect(clipRouteAtProgress([[2, 3], [2, 3]], .5)).toEqual([[2, 3]]);
    expect(clipRouteAtProgress([[0, 0], [10, 0]], .25)).toEqual([[0, 0], [2.5, 0]]);
  });

  it('uses bounded arc-length timing independent of point count', () => {
    expect(routeArcLength([[0, 0], [3, 4]])).toBe(5);
    expect(playbackDuration([[0, 0], [3, 4]])).toBe(900);
    expect(playbackDuration([[0, 0], [10000, 0]])).toBe(6000);
    expect(playbackDuration([[0, 0], [350, 0]])).toBeCloseTo(1000);
  });
});
