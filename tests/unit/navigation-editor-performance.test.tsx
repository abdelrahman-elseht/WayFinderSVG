// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Profiler, type ComponentType } from 'react';
import NavigationEditor from '../../apps/web/components/admin/NavigationEditor';
import * as model from '../../apps/web/components/admin/editor-model';

vi.mock('../../apps/web/components/admin/editor-model', async importOriginal => {
  const actual = await importOriginal<typeof model>();
  return {
    ...actual,
    propagateSourceLinks: vi.fn(actual.propagateSourceLinks),
    moveGraphNodes: vi.fn(actual.moveGraphNodes),
    mergeGraphNodes: vi.fn(actual.mergeGraphNodes),
    mergeSourceLinks: vi.fn(actual.mergeSourceLinks),
    anchoredEdgeGeometryEdits: vi.fn(actual.anchoredEdgeGeometryEdits),
    applyEdgeGeometryEdits: vi.fn(actual.applyEdgeGeometryEdits),
    pointSegmentDistance: vi.fn(actual.pointSegmentDistance),
  };
});

const derivations = [model.propagateSourceLinks, model.moveGraphNodes, model.mergeGraphNodes,
  model.mergeSourceLinks, model.anchoredEdgeGeometryEdits, model.applyEdgeGeometryEdits];
const calls = () => derivations.map(fn => vi.mocked(fn).mock.calls.length);
const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => matrix };

function fixture(floorId: 'GF' | '01') {
  const graph = {
    nodes: [
      { id: 'west', buildingId: 'B03', floorId, point: [10, 50], type: 'junction', status: 'candidate' },
      { id: 'east', buildingId: 'B03', floorId, point: [90, 50], type: 'junction', status: 'candidate' },
    ],
    edges: [{ id: 'corridor', from: 'west', to: 'east', floorId, pathType: 'corridor', distance: 80,
      distanceUnit: 'map-unit', accessibility: 'unknown', restriction: 'unknown', status: 'candidate',
      bidirectional: true, geometry: [[10, 50], [90, 50]] }],
    walls: [[[0, 0], [100, 0]], [[0, 100], [100, 100]]],
    navigableAreas: [[[0, 0], [100, 0], [100, 100], [0, 100]]],
  } as model.Session['graph'];
  return {
    revision: 'performance-test', graph, runtimeGraph: graph,
    spines: [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[10, 50], [90, 50]], sourceReferences: ['source'] }],
    floor: { floor: { id: floorId, viewBox: [0, 0, 100, 100], mapAsset: '/map.svg' }, rooms: [] },
    config: { reviewedConnections: [] }, candidates: [],
    evidence: [{ edgeId: 'corridor', sourceSpineIds: [0], sourceReferences: ['source'], tests: null }],
  } as unknown as model.Session;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return this; } });
  Object.defineProperties(SVGElement.prototype, {
    getScreenCTM: { configurable: true, value: () => matrix },
    setPointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => false },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(floorId: 'GF' | '01') {
  const loaded = fixture(floorId);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => loaded }));
  const result = render(<NavigationEditor floorId={floorId} />);
  await screen.findByRole('button', { name: 'Graph node west' });
  return { ...result, loaded, canvas: screen.getByRole('application') };
}

describe.each(['GF', '01'] as const)('navigation editor derivation cache on %s', floorId => {
  it('reuses graph derivations for zoom, pan, marquee, layer and inspector-only changes', async () => {
    const { canvas } = await setup(floorId);
    const initial = calls();
    expect(initial.every(count => count > 0)).toBe(true);
    const view = canvas.getAttribute('viewBox');
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: 100 });
    expect(canvas.getAttribute('viewBox')).not.toBe(view);
    fireEvent.pointerDown(canvas, { button: 1, clientX: 50, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 25 });
    fireEvent.pointerUp(canvas, { button: 1, clientX: 60, clientY: 25 });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 40, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 20 });
    fireEvent.pointerUp(canvas, { button: 0, clientX: 60, clientY: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Collapse layers/ }));
    fireEvent.click(screen.getByLabelText('Original geometry overlay'));
    fireEvent.change(screen.getByLabelText('Authoring review note'), { target: { value: 'Inspector-only typing' } });
    fireEvent.change(screen.getByLabelText('Inspect graph edge'), { target: { value: 'corridor' } });
    expect(screen.getByLabelText('Navigation edge inspector').textContent).toContain('corridor');
    expect(calls()).toEqual(initial);
    expect(model.pointSegmentDistance).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('skips wall diagnostics without a graph node and reuses them until its geometry changes', async () => {
    const { loaded, canvas } = await setup(floorId);
    expect(model.pointSegmentDistance).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Source control spine:0/0' }), { key: 'Enter' });
    expect(model.pointSegmentDistance).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Graph node west' }), { key: 'Enter' });
    expect(model.pointSegmentDistance).toHaveBeenCalledTimes(loaded.graph.walls.length);
    expect(screen.getByText('Nearest wall').nextElementSibling?.textContent).toBe('50.000 du');
    const selected = calls();
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: -100 });
    fireEvent.change(screen.getByLabelText('Authoring review note'), { target: { value: 'Still the same node' } });
    expect(calls()).toEqual(selected);
    expect(model.pointSegmentDistance).toHaveBeenCalledTimes(loaded.graph.walls.length);
    fireEvent.change(screen.getByLabelText('Graph node Y'), { target: { value: 45 } });
    expect(screen.getByText('Nearest wall').nextElementSibling?.textContent).toBe('45.000 du');
    expect(model.pointSegmentDistance).toHaveBeenCalledTimes(loaded.graph.walls.length * 2);
    fireEvent.click(screen.getByLabelText('Clear selection'));
    fireEvent.change(screen.getByLabelText('Inspect graph edge'), { target: { value: 'corridor' } });
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: 100 });
    expect(model.pointSegmentDistance).toHaveBeenCalledTimes(loaded.graph.walls.length * 2);
  });

  it('rebuilds the live source preview but not the committed graph during a drag, then follows undo/redo', async () => {
    const { canvas } = await setup(floorId);
    const initial = calls();
    const edge = () => canvas.querySelector('[data-edge="corridor"]')?.getAttribute('points');
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 50 });
    expect(calls()).toEqual(initial);
    fireEvent.pointerMove(canvas, { clientX: 15, clientY: 50 });
    expect(edge()).toBe('15,50 90,50');
    expect(calls()).toEqual(initial.map(count => count + 1));
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 50 });
    expect(edge()).toBe('20,50 90,50');
    expect(calls()).toEqual(initial.map(count => count + 2));
    fireEvent.pointerUp(canvas, { button: 0, clientX: 20, clientY: 50 });
    expect(edge()).toBe('20,50 90,50');
    expect(vi.mocked(model.mergeGraphNodes).mock.calls.length).toBe(initial[2] + 4);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(edge()).toBe('10,50 90,50');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(edge()).toBe('20,50 90,50');
    const committed = calls();
    fireEvent.wheel(canvas, { clientX: 50, clientY: 50, deltaY: 100 });
    expect(calls()).toEqual(committed);
  });
});

it('returns an empty merge by identity without inspecting edge geometry or dropping parallel evidence', () => {
  const { graph } = fixture('GF');
  graph.edges.push({ ...graph.edges[0], id: 'parallel' });
  const geometry = vi.spyOn(graph.edges[0], 'geometry', 'get');
  const result = model.mergeGraphNodes(graph, {});
  expect(result.graph).toBe(graph);
  expect(result.graph.nodes).toBe(graph.nodes);
  expect(result.graph.edges).toBe(graph.edges);
  expect(result.aliases).toEqual({});
  expect(result.edgeIds).toEqual({ corridor: 'corridor', parallel: 'parallel' });
  expect(geometry).not.toHaveBeenCalled();
  expect(model.mergeSourceLinks([{ edgeId: 'parallel', sourceSpineIds: [1], sourceReferences: ['distinct'], tests: null }], result.edgeIds))
    .toEqual([{ edgeId: 'parallel', sourceSpineIds: [1], sourceReferences: ['distinct'], tests: null }]);
});

it('invalidates cached graphs when loading a different floor session', async () => {
  const { rerender, canvas } = await setup('GF');
  const initial = calls();
  const upstairs = fixture('01');
  upstairs.graph.nodes[0] = { ...upstairs.graph.nodes[0], id: 'upstairs', point: [20, 50] };
  upstairs.graph.edges[0] = { ...upstairs.graph.edges[0], from: 'upstairs', geometry: [[20, 50], [90, 50]], distance: 70 };
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => upstairs } as Response);
  rerender(<NavigationEditor floorId="01" />);
  await screen.findByRole('button', { name: 'Graph node upstairs' });
  expect(screen.queryByRole('button', { name: 'Graph node west' })).toBeNull();
  expect(screen.getByRole('application').querySelector('[data-edge="corridor"]')?.getAttribute('points')).toBe('20,50 90,50');
  expect(calls().every((count, index) => count > initial[index])).toBe(true);
  expect(canvas.isConnected).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(2);
});

// Opt-in diagnostic only: wall-clock timings are not a CI assertion or browser latency.
it.runIf(process.env.NAV_EDITOR_BENCHMARK === '1')('reports same-process baseline/patched jsdom commit timings', async () => {
  const { transpileModule, ModuleKind, JsxEmit } = await import('typescript');
  const routing = await import('@wayfinding/routing');
  const require = createRequire(import.meta.url);
  const baseline = '6d4af54964c39651693a98ffdad24225c38fb110';
  const loadBaseline = (path: string, dependencies: Record<string, unknown> = {}) => {
    const source = execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' });
    const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } });
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', outputText)((id: string) => dependencies[id] ?? require(id), exports);
    return exports;
  };
  const baselineModel = loadBaseline('apps/web/components/admin/editor-model.ts');
  const BaselineEditor = loadBaseline('apps/web/components/admin/NavigationEditor.tsx', {
    './editor-model': baselineModel, './editor.css': {}, '@wayfinding/routing': routing,
  }).default as ComponentType<{ floorId: 'GF' | '01' }>;
  const summary = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return { median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(2)), p95: Number(sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2)) };
  };
  for (const floorId of ['GF', '01'] as const) {
    const graph = JSON.parse(readFileSync(`data/buildings/B03/${floorId}.graph.json`, 'utf8')) as model.Session['graph'];
    const floor = JSON.parse(readFileSync(`data/buildings/B03/${floorId}.json`, 'utf8')) as model.Session['floor'];
    const [x, y, width, height] = floor.floor.viewBox;
    const loaded = { ...fixture(floorId), graph, runtimeGraph: graph, floor, evidence: [],
      spines: Array.from({ length: 30 }, (_, index) => ({ id: `spine:${index}`, index, kind: 'spine',
        coordinates: [[x + width / 3, y + height / 3 + index], [x + width / 2, y + height / 3 + index], [x + width * 2 / 3, y + height / 3 + index]],
        sourceReferences: ['synthetic-performance-fixture-only'] })) } as model.Session;
    for (const [version, Editor] of [['baseline', BaselineEditor], ['patched', NavigationEditor]] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => loaded }));
      const renderDurations: number[] = [];
      render(<Profiler id="editor" onRender={(_id, phase, duration) => { if (phase === 'update') renderDurations.push(duration); }}><Editor floorId={floorId} /></Profiler>);
      await screen.findByRole('button', { name: `Graph node ${graph.nodes[0].id}` });
      const canvas = screen.getByRole('application');
      const note = screen.getByLabelText('Authoring review note');
      const edges = screen.getByLabelText('Inspect graph edge');
      const results: Record<string, unknown> = { floorId, version, descendants: canvas.querySelectorAll('*').length };
      const actions = {
        zoom: (index: number) => fireEvent.wheel(canvas, { clientX: x + width / 2, clientY: y + height / 2, deltaY: index % 2 ? 100 : -100 }),
        pan: (index: number) => fireEvent.pointerMove(canvas, { clientX: x + index % 2, clientY: y + index % 3 }),
        inspector: (index: number) => fireEvent.change(note, { target: { value: `Timing sample ${index}` } }),
      };
      for (const [name, action] of Object.entries(actions)) {
        if (name === 'pan') fireEvent.pointerDown(canvas, { button: 1, clientX: x, clientY: y });
        if (name === 'inspector') fireEvent.change(edges, { target: { value: graph.edges[0].id } });
        const elapsed: number[] = [], renderTimes: number[] = [];
        for (let index = 0; index < 38; index++) {
          renderDurations.length = 0;
          const start = performance.now();
          action(index);
          const duration = performance.now() - start;
          if (index >= 8) { elapsed.push(duration); renderTimes.push(renderDurations.reduce((sum, value) => sum + value, 0)); }
        }
        if (name === 'pan') fireEvent.pointerUp(canvas, { button: 1, clientX: x, clientY: y });
        results[name] = { eventCommitMs: summary(elapsed), reactRenderMs: summary(renderTimes), samples: elapsed.length };
      }
      process.stdout.write(`NAV_EDITOR_BENCHMARK ${JSON.stringify(results)}\n`);
      expect(fetch).toHaveBeenCalledTimes(1);
      cleanup();
    }
  }
}, 120_000);
