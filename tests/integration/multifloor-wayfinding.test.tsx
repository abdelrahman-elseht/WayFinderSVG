// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorBundle, FloorData, NavigationEdge, NavigationGraph, NavigationNode, Point, RoomContent } from '@wayfinding/map-engine';
import { WayfindingApp } from '../../apps/web/components/WayfindingApp';
import { MapTransitionMarkers } from '../../apps/web/components/MapTransitionMarkers';
import { multiFloorNavigation, routeGraphForTransition } from '../../apps/web/lib/multi-floor-navigation';
import { findRoute } from '@wayfinding/routing';

const browser = vi.hoisted(() => ({
  map: {} as { floor: { id: string; mapAsset: string }; route: Point[]; visibleRoute: Point[]; transitionNodes: NavigationNode[]; playbackProgress: number; onMapReady: (floorId: string) => void },
  deferMapReady: false,
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => browser.router }));
vi.mock('next/dynamic', () => ({
  default: () => (props: typeof browser.map) => {
    browser.map = props;
    React.useEffect(() => {
      if (!browser.deferMapReady) props.onMapReady(props.floor.id);
    }, [props.floor.id, props.onMapReady]);
    return <div data-testid="floor-map"><MapTransitionMarkers nodes={props.transitionNodes} language="en" center={[0, 0]} /></div>;
  },
}));
vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); browser.deferMapReady = false; browser.router.push.mockClear(); browser.router.replace.mockClear(); });

function landingNode(id: string, floorId: 'GF' | '01', point: Point, type: 'escalator' | 'elevator' = 'escalator'): NavigationNode {
  return { id, buildingId: 'SYNTHETIC_TEST_BUILDING', floorId, point, type, status: 'candidate',
    transitionId: type === 'escalator' ? 'B03-transition-test' : 'B03-transition-lift-test',
    transitionName: type === 'escalator' ? 'Test escalator' : 'Test lift',
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
  const lift = landingNode(ground ? 'gf-lift' : 'f1-lift', floorId, [12, 0], 'elevator');
  const edge = (from: NavigationNode, to: NavigationNode): NavigationEdge => ({
    id: `${from.id}-${to.id}`, from: from.id, to: to.id, floorId,
    pathType: 'corridor', distance: Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1]),
    distanceUnit: 'map-unit', accessibility: 'unknown', restriction: 'open', status: 'candidate',
    bidirectional: true, geometry: [from.point, to.point],
  });
  const graph: NavigationGraph = { routingPolicy: 'drawing-based', nodes: [start, end, lift],
    edges: [edge(start, end), edge(ground ? start : lift, ground ? lift : end)],
    metersPerUnit: null, calibrationStatus: 'unknown', navigableAreas: [[[-1, -1], [21, -1], [21, 1], [-1, 1]]],
    walls: [], status: 'candidate' };
  const room = (id: 'start' | 'destination', nodeId: string, code: string) => ({
    id, code, buildingId: 'SYNTHETIC_TEST_BUILDING', floorId,
    name: { en: id === 'start' ? 'Main Entrance' : code, ar: id === 'start' ? 'Main Entrance' : code },
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
    rooms: [room(ground ? 'start' : 'destination', ground ? 'gf-start' : 'f1-destination', ground ? 'G-01' : 'DEST')],
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
    expect(findRoute(routeGraphForTransition(routeGraph, 'B03-transition-test'), 'gf-start', 'f1-destination').status).toBe('ok');
    let now = 0;
    let tick: FrameRequestCallback = () => {};
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<WayfindingApp {...ground} floorBundles={floorBundles} routeGraph={routeGraph} floorOptions={floorBundles.map(bundle => bundle.floorData.floor)} audioService={{
      speak: vi.fn(), stop: vi.fn(), setMuted: vi.fn(), isSupported: () => true,
    }} />);

    expect(screen.getByText('Test escalator')).toBeTruthy();
    expect(screen.getByText('Test lift')).toBeTruthy();

    fireEvent.change(screen.getByTestId('start-select'), { target: { value: startRoom === 'start' ? '' : startRoom } });
    fireEvent.change(screen.getByTestId('destination-select'), { target: { value: destinationRoom } });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    const transitionType = _direction === 'GF to 01' ? 'escalator' : 'elevator';
    fireEvent.click(screen.getByRole('button', { name: new RegExp(transitionType === 'elevator' ? 'Lift route' : 'Escalator route', 'i') }));
    await waitFor(() => expect(screen.getByTestId('route-status').className).toContain('ok'));
    const instruction = transitionType === 'elevator' ? 'Take the elevator' : 'Take the escalator';
    expect(screen.getByTestId('route-status').textContent).toContain(`${instruction} to floor ${destinationFloor}.`);
    await waitFor(() => expect(browser.map.floor.id).toBe(startFloor));
    expect(browser.map.floor.mapAsset).toBe(`/maps/SYNTHETIC_TEST_BUILDING/${startFloor}/master.svg`);

    now = 1100;
    act(() => tick(now));
    await waitFor(() => expect(browser.map.floor.id).toBe(destinationFloor));
    expect(browser.map.floor.mapAsset).toBe(`/maps/SYNTHETIC_TEST_BUILDING/${destinationFloor}/master.svg`);
    expect(screen.getByText('Test escalator')).toBeTruthy();
    expect(screen.getByText('Test lift')).toBeTruthy();
    expect(window.location.search).toContain(`floor=${destinationFloor}`);
    expect(browser.router.replace).not.toHaveBeenCalled();

    await waitFor(() => expect(browser.map.visibleRoute.at(-1)).toEqual(expect.arrayContaining([expect.any(Number)])));
    const transitionLanding = transitionType === 'escalator' ? 10 : 12;
    expect(browser.map.visibleRoute.at(-1)![0]).toBe(transitionLanding);
  });

  it('opens the transition chooser from Go here on a First Floor room with the default start', async () => {
    const ground = floorBundle('GF');
    const first = floorBundle('01');
    const floorBundles = [ground, first];
    const routeGraph = multiFloorNavigation(floorBundles);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<WayfindingApp {...ground} floorBundles={floorBundles} routeGraph={routeGraph} floorOptions={floorBundles.map(bundle => bundle.floorData.floor)} audioService={{
      speak: vi.fn(), stop: vi.fn(), setMuted: vi.fn(), isSupported: () => true,
    }} />);

    fireEvent.change(screen.getByTestId('floor-select'), { target: { value: '01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    fireEvent.click(screen.getByRole('button', { name: /DEST/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Go here' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Main Entrance');
    expect(dialog.textContent).toContain('Test escalator');
    expect(dialog.textContent).toContain('Test lift');
  });

  it('holds playback at a landing until the destination-floor map is ready', async () => {
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
    browser.deferMapReady = true;
    render(<WayfindingApp {...ground} floorBundles={floorBundles} routeGraph={routeGraph}
      floorOptions={floorBundles.map(bundle => bundle.floorData.floor)} audioService={{
        speak: vi.fn(), stop: vi.fn(), setMuted: vi.fn(), isSupported: () => true,
      }} />);

    act(() => browser.map.onMapReady('GF'));
    fireEvent.change(screen.getByTestId('destination-select'), { target: { value: 'destination' } });
    fireEvent.click(await screen.findByRole('button', { name: /Escalator route/ }));
    await waitFor(() => expect(screen.getByTestId('route-status').className).toContain('ok'));

    now = 1000;
    act(() => tick(now));
    await waitFor(() => expect(browser.map.floor.id).toBe('01'));
    const transitionProgress = browser.map.playbackProgress;

    now = 2500;
    act(() => tick(now));
    expect(browser.map.playbackProgress).toBe(transitionProgress);
    expect(browser.map.visibleRoute).toHaveLength(1);

    act(() => browser.map.onMapReady('01'));
    now = 3700;
    act(() => tick(now));
    expect(browser.map.playbackProgress).toBe(transitionProgress);
    expect(browser.map.visibleRoute).toHaveLength(1);

    now = 5100;
    act(() => tick(now));
    now += 40;
    act(() => tick(now));
    await waitFor(() => expect(browser.map.visibleRoute.length).toBeGreaterThan(1));
  });
});
