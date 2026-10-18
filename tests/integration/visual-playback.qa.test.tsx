// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FloorData, Point, RoomContent } from '@wayfinding/map-engine';
import { WayfindingApp } from '../../apps/web/components/WayfindingApp';
import { createRouteSmoother } from '../../packages/routing/src/visual-route';
import { clipVisualRouteAtProgress } from '../../apps/web/components/routePlayback';
import { syntheticCorner } from '../fixtures/routing';
import floorJson from '../../data/buildings/B03/GF.json';
import contentJson from '../../content/B03/GF.json';

const captured = vi.hoisted(() => ({ props: {} as { route: Point[]; visibleRoute: Point[]; playbackProgress: number } }));
vi.mock('next/dynamic', () => ({
  default: () => (props: typeof captured.props) => { captured.props = props; return <div />; },
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('passes cached visual geometry through playback (reduced motion: %s)', reduced => {
  const floor = structuredClone(floorJson) as unknown as FloorData;
  const graph = syntheticCorner();
  graph.edges[1].pathType = 'corridor';
  graph.navigableAreas = [[[-1, -1], [11, -1], [11, 11], [-1, 11]]];
  floor.kiosks[0].nodeId = 'a';
  floor.kiosks[0].status = 'confirmed';
  floor.rooms[0].doorNodeId = 'c';
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  let tick: FrameRequestCallback = () => {};
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const audio = { speak: vi.fn(), stop: vi.fn(), setMuted: vi.fn(), isSupported: () => true };
  render(<WayfindingApp floorData={floor} graph={graph} contents={contentJson as RoomContent[]} audioService={audio} />);
  fireEvent.change(screen.getByTestId('destination-select'), { target: { value: floor.rooms[0].id } });
  const original: Point[] = [[0, 0], [10, 0], [10, 10]];
  const visual = createRouteSmoother(graph)(original);
  expect(visual.points.length).toBeGreaterThan(original.length);
  expect(captured.props.route).toEqual(original);
  if (!reduced) {
    expect(captured.props.visibleRoute).toEqual([[0, 0]]);
    now = 450;
    act(() => tick(now));
    expect(captured.props.playbackProgress).toBe(0.5);
    expect(captured.props.visibleRoute).toEqual(clipVisualRouteAtProgress(visual, 0.5));
    now = 900;
    act(() => tick(now));
  }
  expect(captured.props.visibleRoute).toEqual(visual.points);
  expect(captured.props.route).toEqual(original);
});
