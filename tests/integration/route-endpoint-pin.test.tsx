// @vitest-environment jsdom
import { act, Profiler } from 'react';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, extend, type Catalogue, type RootState, type RootStore } from '@react-three/fiber';
import * as THREE from 'three';
import { RouteEndpointPin } from '../../apps/web/components/RouteEndpointPin';
import { RouteOverlay } from '../../apps/web/components/FloorMap';
import { BLOCK_HEIGHT } from '../../apps/web/components/mapBlocks';
import { highContrastMapPalette, mapPalette } from '../../apps/web/components/palette';

const HOVER_Y = BLOCK_HEIGHT * 1.35;
const BOB_AMPLITUDE = .035;

vi.mock('@react-three/drei', () => ({
  Line: ({ points }: { points: number[][] }) => <group name="route-line" userData={{ points }} />,
  Html: () => null,
  OrbitControls: () => null,
}));
// Match Fiber's CJS Three constructors; ESM duplicates break instanceof checks.
extend(createRequire(import.meta.url)('three') as Catalogue);
let root: ReturnType<typeof createRoot>;
let state: RootState;
let store: RootStore;
let reduced: boolean;
let hidden: boolean;
let mediaListeners: Set<() => void>;
let invalidate: ReturnType<typeof vi.fn>;
let mediaAdd: ReturnType<typeof vi.fn>;
let mediaRemove: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  reduced = false; hidden = false; mediaListeners = new Set();
  mediaAdd = vi.fn((_: string, listener: () => void) => mediaListeners.add(listener));
  mediaRemove = vi.fn((_: string, listener: () => void) => mediaListeners.delete(listener));
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return reduced; }, addEventListener: mediaAdd, removeEventListener: mediaRemove })));
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
  root = createRoot(document.createElement('canvas'));
  await root.configure({
    frameloop: 'never', orthographic: true, size: { width: 800, height: 600, top: 0, left: 0 },
    camera: { position: [5, 30, 22], zoom: 35 },
    gl: { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn() } as unknown as THREE.WebGLRenderer,
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function mount(element: React.ReactNode) {
  await act(async () => { store = root.render(null); });
  invalidate = vi.fn<RootState['invalidate']>();
  await act(async () => { store.setState({ invalidate: invalidate as RootState['invalidate'] }); });
  await act(async () => { state = root.render(element).getState(); });
}

function frameloop(value: RootState['frameloop']) { act(() => store.setState({ frameloop: value })); state = store.getState(); }

function frame(delta = .04) {
  act(() => state.internal.subscribers.forEach(subscription => subscription.ref.current(state, delta)));
}
function group(name: string) { return state.scene.getObjectByName(name)!; }
function material(name: string) { return (group(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material; }
function preferences(value: boolean) { reduced = value; act(() => mediaListeners.forEach(listener => listener())); }
function visibility(value: boolean) { hidden = value; act(() => document.dispatchEvent(new Event('visibilitychange'))); }

describe('3D route endpoint pins in the real R3F scene', () => {
  it.each(['origin', 'destination'] as const)('renders an independently floating dimensional %s with color, white trim, distinct solid glyph and fixed endpoint', async role => {
    await mount(<RouteEndpointPin role={role} position={[1.125, .095, -2.75]} forcedColors={false} />);
    const anchor = group(`route-${role}-anchor`);
    expect(anchor.position.toArray()).toEqual([1.125, .095, -2.75]);
    expect(anchor.userData.endpointRole).toBe(role);
    const mesh = group('endpoint-drop') as THREE.Mesh<THREE.ExtrudeGeometry>;
    expect(mesh.geometry.type).toBe('ExtrudeGeometry');
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.max.z - mesh.geometry.boundingBox!.min.z).toBeGreaterThan(.12);
    expect(material('endpoint-drop').color.getHexString()).toBe((role === 'origin' ? mapPalette.route : mapPalette.routeDestination).slice(1).toLowerCase());
    expect(material('endpoint-white-trim').color.getHexString()).toBe('ffffff');
    expect(group(role === 'origin' ? 'origin-circle-glyph' : 'destination-diamond-glyph')).toBeTruthy();
    expect(anchor.children).toEqual([group('endpoint-float')]);
    for (const name of ['endpoint-contact-trim', 'endpoint-contact', 'endpoint-leader']) {
      expect(anchor.getObjectByName(name)).toBeUndefined();
    }
    frame();
    expect(anchor.position.toArray()).toEqual([1.125, .095, -2.75]);
    expect(group('endpoint-float').position.y).not.toBe(HOVER_Y);
    for (const name of ['endpoint-white-trim', 'endpoint-drop', 'endpoint-badge']) expect(material(name).depthTest).toBe(true);
  });

  it.each([false, true])('orders both complete pins after transparent map ink, retaining depth (forced colors: %s)', async forcedColors => {
    await mount(<RouteOverlay route={[[200, 400], [900, 1200]]} center={[100, 200]} forcedColors={forcedColors} />);
    for (const role of ['origin', 'destination'] as const) {
      const anchor = group(`route-${role}-anchor`);
      const meshes: THREE.Mesh[] = [];
      anchor.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        meshes.push(mesh);
        const surface = mesh.material as THREE.Material;
        // Opaque objects render before all transparent ink regardless of renderOrder.
        expect(surface.transparent).toBe(true);
        expect(surface.opacity).toBe(1);
        expect(surface.depthTest).toBe(true);
        expect(surface.depthWrite).toBe(true);
        expect(mesh.renderOrder).toBeGreaterThan(22);
        // A nested default-order group would undo the endpoint's sort priority.
        for (let parent = mesh.parent; parent; parent = parent.parent) {
          if (parent.type === 'Group') expect(parent.renderOrder).toBeGreaterThan(22);
          if (parent === anchor) break;
        }
      });
      expect(meshes.map(mesh => mesh.name)).toEqual(['endpoint-white-trim', 'endpoint-drop', 'endpoint-badge', role === 'origin' ? 'origin-circle-glyph' : 'destination-diamond-glyph']);
      expect(meshes.map(mesh => mesh.renderOrder)).toEqual([26, 27, 28, 29]);
      expect((anchor.getObjectByName('endpoint-white-trim') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.type).toBe('MeshStandardMaterial');
      expect((anchor.getObjectByName('endpoint-drop') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.type).toBe('MeshStandardMaterial');
    }
  });

  it('faces both oblique and near overhead cameras without moving the exact source anchor', async () => {
    await mount(<RouteEndpointPin role="origin" position={[3, .095, 7]} forcedColors={false} />);
    for (const position of [[5, 30, 22], [0, 30, .01]]) {
      state.camera.position.set(...position as [number, number, number]); state.camera.lookAt(0, 0, 0);
      frame();
      expect(group('endpoint-face').quaternion.angleTo(state.camera.quaternion)).toBeLessThan(.000001);
      expect(group('route-origin-anchor').position.toArray()).toEqual([3, .095, 7]);
    }
  });

  it.each(['origin', 'destination'] as const)('keeps the lowered %s floating above illustrative roofs and label anchors without supports', async role => {
    const endpoint: [number, number, number] = [1.125, .095, -2.75];
    await mount(<RouteEndpointPin role={role} position={endpoint} forcedColors={false} />);
    const anchor = group(`route-${role}-anchor`);
    const floating = group('endpoint-float');
    expect(floating.position.toArray()).toEqual([0, HOVER_Y, 0]);
    expect(HOVER_Y).toBeCloseTo(.8775, 10);
    expect(anchor.children).toEqual([floating]);
    for (const position of [[5, 30, 22], [0, 30, .01], [-22, 15, -5]] as [number, number, number][]) {
      state.camera.position.set(...position); state.camera.lookAt(0, 0, 0);
      for (let i = 0; i < 240; i++) {
        frame(i === 0 ? 60 : 1 / 30);
        state.scene.updateMatrixWorld(true);
        const height = floating.position.y;
        expect(height).toBeGreaterThanOrEqual(HOVER_Y - BOB_AMPLITUDE);
        expect(height).toBeLessThanOrEqual(HOVER_Y + BOB_AMPLITUDE);
        expect(anchor.position.toArray()).toEqual(endpoint);
        expect(floating.position.x).toBe(0);
        expect(floating.position.z).toBe(0);
        const floatingPosition = floating.getWorldPosition(new THREE.Vector3());
        expect(floatingPosition.x).toBe(endpoint[0]);
        expect(floatingPosition.y).toBeCloseTo(endpoint[1] + height, 10);
        expect(floatingPosition.z).toBe(endpoint[2]);
        // HTML rectangles still require label-layer occlusion; this checks their scene anchors only.
        expect(new THREE.Box3().setFromObject(group('endpoint-face')).min.y).toBeGreaterThan(BLOCK_HEIGHT + .13);
      }
    }
  });

  it('updates refs, not React renders, and preserves the continuous scene frameloop', async () => {
    const commits = vi.fn();
    await mount(<Profiler id="pin" onRender={commits}><RouteEndpointPin role="origin" position={[0, .095, 0]} forcedColors={false} /></Profiler>);
    frameloop('always'); invalidate.mockClear(); const count = commits.mock.calls.length;
    for (let i = 0; i < 120; i++) frame();
    expect(commits).toHaveBeenCalledTimes(count);
    expect(invalidate).not.toHaveBeenCalled();
    expect(state.frameloop).toBe('always');
  });

  it('honors initial and live reduced-motion changes and cleans listeners on unmount', async () => {
    reduced = true;
    const removeVisibility = vi.spyOn(document, 'removeEventListener');
    await mount(<RouteEndpointPin role="destination" position={[0, .095, 0]} forcedColors={false} />);
    frameloop('demand'); invalidate.mockClear(); frame();
    expect(group('endpoint-float').position.y).toBe(HOVER_Y);
    expect(invalidate).not.toHaveBeenCalled();
    preferences(false); frame();
    expect(group('endpoint-float').position.y).not.toBe(HOVER_Y);
    expect(invalidate).toHaveBeenCalled();
    preferences(true); invalidate.mockClear(); frame();
    expect(group('endpoint-float').position.y).toBe(HOVER_Y);
    expect(invalidate).not.toHaveBeenCalled();
    await act(async () => root.render(null));
    expect(mediaListeners.size).toBe(0);
    expect(mediaRemove).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeVisibility).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('stops hidden-page demand invalidation and resumes without a time jump', async () => {
    await mount(<RouteEndpointPin role="origin" position={[0, .095, 0]} forcedColors={false} />);
    frameloop('demand'); frame(); visibility(true); invalidate.mockClear();
    frame(60);
    expect(group('endpoint-float').position.y).toBe(HOVER_Y);
    expect(invalidate).not.toHaveBeenCalled();
    visibility(false); frame(60);
    expect(invalidate).toHaveBeenCalled();
    expect(Math.abs(group('endpoint-float').position.y - HOVER_Y)).toBeLessThan(.01);
  });

  it.each(['origin', 'destination'] as const)('uses static high contrast treatment for %s and releases declarative geometry/materials', async role => {
    await mount(<RouteEndpointPin role={role} position={[0, .095, 0]} forcedColors />);
    frame();
    expect(group('endpoint-float').position.y).toBe(HOVER_Y);
    expect(material('endpoint-drop').color.getHexString()).toBe((role === 'origin' ? highContrastMapPalette.route : highContrastMapPalette.routeDestination).slice(1).toLowerCase());
    const disposals = ['endpoint-white-trim', 'endpoint-drop', 'endpoint-badge', role === 'origin' ? 'origin-circle-glyph' : 'destination-diamond-glyph'].flatMap(name => {
      const mesh = group(name) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      return [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material, 'dispose')];
    });
    await act(async () => root.render(null));
    await vi.waitFor(() => { for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce(); });
  });

  it('keeps both full-route endpoints fixed during empty, one-point and partial reveals', async () => {
    const fullRoute: [number, number][] = [[200, 400], [450, 600], [900, 1200]];
    for (const route of [[], [[200, 400]], [[200, 400], [250, 440]], fullRoute] as [number, number][][]) {
      await mount(<RouteOverlay route={route} fullRoute={fullRoute} center={[100, 200]} forcedColors={false} />);
      frame();
      expect(group('route-origin-anchor').position.toArray()).toEqual([1, .095, 2]);
      expect(group('route-destination-anchor').position.toArray()).toEqual([8, .095, 10]);
      expect(state.scene.getObjectsByProperty('name', 'route-line')).toHaveLength(route.length < 2 ? 0 : 2);
    }
    await act(async () => root.render(<RouteOverlay route={[]} fullRoute={[]} center={[100, 200]} forcedColors={false} />));
    expect(state.scene.getObjectByName('route-origin-anchor')).toBeUndefined();
    expect(mediaListeners.size).toBe(0);
  });
});
