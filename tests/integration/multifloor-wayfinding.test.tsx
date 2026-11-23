// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorBundle, FloorData, NavigationEdge, NavigationGraph, NavigationNode, Point, RoomContent } from '@wayfinding/map-engine';
import { WayfindingApp } from '../../apps/web/components/WayfindingApp';
import { multiFloorNavigation } from '../../apps/web/lib/multi-floor-navigation';

const browser = vi.hoisted(() => ({
  map: {} as { floor: { id: string; mapAsset: string }; route: Point[]; visibleRoute: Point[] },
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => browser.router }));
vi.mock('next/dynamic', () => ({
  default: () => (props: typeof browser.map) => { browser.map = props; return <div data-testid="floor-map" />; },
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); browser.router.push.mockClear(); browser.router.replace.mockClear(); });

function landingNode(id: string, floorId: 'GF' | '01', point: Point): NavigationNode {
  return { id, buildingId: 'SYNTHETIC_TEST_BUILDING', floorId, point, type: 'escalator', status: 'candidate',
    transitionId: 'B03-transition-test', transitionName: 'Test escalator',
    transitionAccessibility: 'unknown', transitionRestriction: 'open' };
}

function floorBundle(floorId: 'GF' | '01'): FloorBundle {
  const ground = floorId === 'GF';
  const start = ground
    ? { id: 'gf-start', buildingId: 'SYNTHETIC_TEST_BUILDING', floorId, point: [0, 0] as Point, type: 'door' as const, roomId: 'start', status: 'candidate' as const }
    : landingNode('f1-escalator', '01', [10, 0]);
  const end = ground
    ? landingNode('gf-escalator', 'GF', [10, 0])
    : { id: 'f1-destination', buildingId: 'SYNTHETIC_TEST_BUILDING', floorId, point: [20, 0] as Point, type: 'door' as const, roomId: 'destination', status: 'candidate' as const };
  const edge: NavigationEdge = { id: `${start.id}-${end.id}`, from: start.id, to: end.id, floorId,
    pathType: 'corridor', distance: 10, distanceUnit: 'map-unit', accessibility: 'confirmed',
    restriction: 'open', status: 'candidate', bidirectional: true, geometry: [start.point, end.point] };
  const graph: NavigationGraph = { routingPolicy: 'drawing-based', nodes: [start, end], edges: [edge],
    metersPerUnit: null, calibrationStatus: 'unknown', navigableAreas: [[[-1, -1], [21, -1], [21, 1], [-1, 1]]],
    walls: [], status: 'candidate' };
  const room = (id: 'start' | 'destination', nodeId: string, code: string) => ({
    id, code, buildingId: 'SYNTHETIC_TEST_BUILDING', floorId, name: { en: code, ar: code },
    category: 'other' as const, polygon: null, geometryRef: null, centroid: [0, 0] as Point,
    doorNodeId: nodeId, aliases: [], contentRef: id, public: true, geometryStatus: 'candidate' as const,
    provenance: [],
  });
  const floorData = {
    schemaVersion: 1,
    building: { id: 'SYNTHETIC_TEST_BUILDING', name: { en: 'Synthetic', ar: 'Synthetic' }, floorIds: ['GF', '01'] },
    floor: { id: floorId, buildingId: 'SYNTHETIC_TEST_BUILDING', name: { en: floorId, ar: floorId },
      level: ground ? 0 : 1, viewBox: [-1, -1, 22, 2], mapAsset: `/maps/SYNTHETIC_TEST_BUILDING/${floorId}/master.svg`,
      metersPerUnit: null, calibrationStatus: 'unknown' },
    rooms: [room(ground ? 'start' : 'destination', ground ? 'gf-start' : 'f1-destination', ground ? 'START' : 'DEST')],
    kiosks: [], navigationDefaults: ground ? { startRoomId: 'start' } : undefined,
  } as FloorData;
  const contents: RoomContent[] = [{ id: ground ? 'start' : 'destination', description: { en: '', ar: '' },
    placeholder: true, image: null, imageAlt: { en: '', ar: '' } }];
  return { floorData, graph, contents };
}

describe('public cross-floor route playback', () => {
  it.each([
    ['GF to 01', 'start', 'destination', 'GF', '01', 1],
    ['01 to GF', 'destination', 'start', '01', 'GF', -1],
  ] as const)('switches floors during paired escalator playback from %s', async (
    _direction, startRoom, destinationRoom, startFloor, destinationFloor, routeDirection,
  ) => {
    const ground = floorBundle('GF');
    const first = floorBundle('01');
    const floorBundles = [ground, first];
    const routeGraph = multiFloorNavigation(floorBundles);
    let now = 0;
    let tick: FrameRequestCallback = () => {};
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<WayfindingApp {...ground} floorBundles={floorBundles} routeGraph={routeGraph} audioService={{
      speak: vi.fn(), stop: vi.fn(), setMuted: vi.fn(), isSupported: () => true,
    }} />);

    fireEvent.change(screen.getByTestId('start-select'), { target: { value: startRoom === 'start' ? '' : startRoom } });
    fireEvent.change(screen.getByTestId('destination-select'), { target: { value: destinationRoom } });
    await waitFor(() => expect(screen.getByTestId('route-status').className).toContain('ok'));
    expect(screen.getByTestId('route-status').textContent).toContain(`Take the escalator to floor ${destinationFloor}.`);
    await waitFor(() => expect(browser.map.floor.id).toBe(startFloor));
    expect(browser.map.floor.mapAsset).toBe(`/maps/SYNTHETIC_TEST_BUILDING/${startFloor}/master.svg`);

    now = 1100;
    act(() => tick(now));
    await waitFor(() => expect(browser.map.floor.id).toBe(destinationFloor));
    expect(browser.map.floor.mapAsset).toBe(`/maps/SYNTHETIC_TEST_BUILDING/${destinationFloor}/master.svg`);
    expect(browser.router.replace).toHaveBeenCalledWith(expect.stringContaining(`floor=${destinationFloor}`));

    now = 2800;
    act(() => tick(now));
    await waitFor(() => expect(browser.map.visibleRoute.at(-1)).toEqual(expect.arrayContaining([expect.any(Number)])));
    if (routeDirection > 0) expect(browser.map.visibleRoute.at(-1)![0]).toBeGreaterThan(10);
    else expect(browser.map.visibleRoute.at(-1)![0]).toBeLessThan(10);
  });
});
