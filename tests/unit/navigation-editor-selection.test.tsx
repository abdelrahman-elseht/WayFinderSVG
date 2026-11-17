// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NavigationEditor from '../../apps/web/components/admin/NavigationEditor';
import { mergeGraphNodes, moveGraphNodes, type Session } from '../../apps/web/components/admin/editor-model';

const session = {
  revision: 'selection-test',
  spines: [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[10, 10], [30, 10], [80, 10]], sourceReferences: ['source'] }],
  graph: { nodes: [
    { id: 'junction', point: [12, 10], type: 'junction', floorId: 'GF', buildingId: 'B03', status: 'candidate' },
    { id: 'junction-2', point: [90, 90], type: 'junction', floorId: 'GF', buildingId: 'B03', status: 'candidate' },
  ], edges: [], walls: [], navigableAreas: [] },
  floor: { floor: { viewBox: [0, 0, 100, 100], mapAsset: '/map.svg' }, rooms: [] },
  config: { reviewedConnections: [] }, evidence: [], candidates: [],
} as unknown as Session;
const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => matrix };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...session, runtimeGraph: session.graph }) }));
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return this; } });
  Object.defineProperties(SVGElement.prototype, {
    getScreenCTM: { configurable: true, value: () => matrix },
    setPointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => false },
    scrollIntoView: { configurable: true, value: () => {} },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function setup(floorId: 'GF' | '01' = 'GF') {
  render(<NavigationEditor floorId={floorId} />);
  const source = await screen.findByRole('button', { name: 'Source control spine:0/0' });
  const graph = screen.getByRole('button', { name: 'Graph node junction' });
  const canvas = screen.getByRole('application');
  const click = (x = 10, y = 10) => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(canvas, { button: 0, clientX: x, clientY: y, pointerId: 1 });
  };
  return { source, graph, canvas, click };
}

describe.each(['GF', '01'] as const)('navigation editor point selection on %s', floorId => {
  it('authors candidate room nodes and walkable polygons into the publish payload', async () => {
    let submitted: Record<string, unknown> | undefined;
    const room = { id: `B03-${floorId}-R1`, floorId, code: 'R1', name: { en: 'Lab', ar: 'معمل' }, doorNodeId: null };
    const graph = {
      ...session.graph,
      nodes: session.graph.nodes.map(node => ({ ...node, floorId })),
      navigableAreas: [[[0, 0], [100, 0], [100, 100], [0, 100]]],
    };
    const authoredSession = {
      ...session, graph, runtimeGraph: graph,
      floor: { ...session.floor, floor: { ...session.floor.floor, id: floorId }, rooms: [room] },
      authoringSourceReferences: ['maps/B03/source.svg#plan'],
    };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init?.method) return Promise.resolve({ ok: true, json: async () => authoredSession });
      submitted = JSON.parse(String(init.body));
      return Promise.resolve({ ok: true, json: async () => ({ saved: true, valid: true, revision: 'saved', graph, runtimeGraph: graph, floor: authoredSession.floor }) });
    }));
    render(<NavigationEditor floorId={floorId} />);
    await screen.findByRole('button', { name: 'Graph node junction' });
    fireEvent.change(screen.getByLabelText('Authoring source reference'), { target: { value: 'maps/B03/source.svg#plan' } });
    fireEvent.change(screen.getByLabelText('Authoring review note'), { target: { value: 'Reviewed position against the supplied floor drawing.' } });
    fireEvent.change(screen.getByLabelText('Entry / approach room'), { target: { value: room.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Place room approach' }));
    const canvas = screen.getByRole('application');
    fireEvent.pointerDown(canvas, { button: 0, clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas, { button: 0, clientX: 20, clientY: 20, pointerId: 1 });
    expect(screen.getByRole('button', { name: /Graph node B03-.*admin-node-/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start walkable polygon' }));
    for (const [clientX, clientY] of [[40, 40], [60, 40], [60, 60]]) {
      fireEvent.pointerDown(canvas, { button: 0, clientX, clientY, pointerId: 1 });
      fireEvent.pointerUp(canvas, { button: 0, clientX, clientY, pointerId: 1 });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(submitted).toBeDefined());
    expect((submitted!.addedNodes as Array<{ status: string; type: string }>)[0]).toMatchObject({ status: 'candidate', type: 'entrance' });
    expect((submitted!.roomEntryBindings as Array<{ roomId: string }>)[0].roomId).toBe(room.id);
    expect((submitted!.navigableAreaEdits as Array<{ operation: string; polygon: unknown[] }>)[0]).toMatchObject({ operation: 'add', polygon: expect.any(Array) });
  });

  it('cycles nearby source/graph clicks without applying pointer jitter as a move', async () => {
    const { source, graph, canvas, click } = await setup(floorId);
    click();
    expect(source.getAttribute('aria-pressed')).toBe('true');
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 12, clientY: 11 });
    fireEvent.pointerUp(canvas, { clientX: 12, clientY: 11 });
    expect(graph.getAttribute('aria-pressed')).toBe('true');
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(source.getAttribute('cx')).toBe('10');
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Selection targets').textContent).toContain('Graph node junction');
    click();
    expect(source.getAttribute('aria-pressed')).toBe('true');
  });
  it('selects an obscured individual handle by keyboard and retains additive selection', async () => {
    const { source, graph } = await setup(floorId);
    graph.focus();
    fireEvent.keyDown(graph, { key: 'Enter' });
    expect(graph.getAttribute('aria-pressed')).toBe('true');
    source.focus();
    fireEvent.keyDown(source, { key: ' ', code: 'Space', shiftKey: true });
    expect(source.getAttribute('aria-pressed')).toBe('true');
    expect(graph.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(source, { key: 'ArrowRight' });
    expect(source.getAttribute('cx')).toBe('11');
    expect(graph.getAttribute('cx')).toBe('13');
    fireEvent.keyDown(source, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'Graph node junction' })).toBeNull();
    expect(source.getAttribute('cx')).toBe('11');
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Source endpoints retained: spine:0/0'))).toBe(true);
  });
  it('drags the selected group instead of cycling on a repeated pointer down', async () => {
    const { source, graph, canvas, click } = await setup(floorId);
    click();
    const other = screen.getByRole('button', { name: 'Source control spine:0/2' });
    fireEvent.keyDown(other, { key: 'Enter', ctrlKey: true });
    // Keyboard selection resets click cycling; establish the pointer target again.
    click();
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 16, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 16, clientY: 10 });
    expect(source.getAttribute('cx')).toBe('16');
    expect(other.getAttribute('cx')).toBe('86');
    expect(graph.getAttribute('aria-pressed')).toBe('false');
    expect(graph.getAttribute('cx')).toBe('12');
  });
  it('excludes locked and filtered handles from pointer and keyboard selection', async () => {
    const { graph, click } = await setup(floorId);
    const row = screen.getByText('Junction nodes').closest<HTMLElement>('.layer-row')!;
    fireEvent.click(within(row).getByRole('button', { name: /lock/i }));
    expect(graph.getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(graph, { key: 'Enter' });
    click(); click();
    expect(graph.getAttribute('aria-pressed')).toBe('false');
    fireEvent.change(screen.getByLabelText('Node type'), { target: { value: 'junction' } });
    click();
    expect(screen.getByLabelText('Selection targets').textContent).toContain('targets: 0');
  });
  it('keeps unrelated selected points while cycling and does not delete hidden nodes', async () => {
    const { source, graph, click } = await setup(floorId);
    const other = screen.getByRole('button', { name: 'Source control spine:0/2' });
    fireEvent.keyDown(other, { key: 'Enter' });
    fireEvent.keyDown(source, { key: 'Enter', ctrlKey: true });
    click(); click();
    expect(graph.getAttribute('aria-pressed')).toBe('true');
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(other.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByLabelText('Junction nodes visibility'));
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Delete' });
    fireEvent.click(screen.getByLabelText('Junction nodes visibility'));
    expect(screen.getByRole('button', { name: 'Graph node junction' }).getAttribute('cx')).toBe('12');
  });
  it('leaves draw and lasso gestures in charge rather than picking nearby handles', async () => {
    const { source, graph, canvas, click } = await setup(floorId);
    fireEvent.click(screen.getByRole('button', { name: 'Draw corridor' }));
    click();
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(graph.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('1 intermediate points')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lasso' }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 8, clientY: 8 });
    for (const [clientX, clientY] of [[15, 8], [15, 15], [8, 15], [8, 8]]) fireEvent.pointerMove(canvas, { clientX, clientY });
    fireEvent.pointerUp(canvas, { clientX: 8, clientY: 8 });
    expect(source.getAttribute('aria-pressed')).toBe('true');
    expect(graph.getAttribute('aria-pressed')).toBe('true');
  });
  it('retains box, pan, additive toggle and cancellation behavior', async () => {
    const { source, graph, canvas, click } = await setup(floorId);
    fireEvent.pointerDown(canvas, { button: 0, clientX: -10, clientY: -10 });
    fireEvent.pointerMove(canvas, { clientX: 15, clientY: 15 });
    fireEvent.pointerUp(canvas, { clientX: 15, clientY: 15 });
    expect(source.getAttribute('aria-pressed')).toBe('true');
    expect(graph.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(canvas, { key: ' ', code: 'Space' });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 15, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 15, clientY: 10 });
    fireEvent.keyUp(canvas, { key: ' ', code: 'Space' });
    expect(canvas.getAttribute('viewBox')).toBe('-5 0 100 100');
    expect(source.getAttribute('cx')).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: /^Multi-select$/ }));
    click();
    expect(source.getAttribute('aria-pressed')).toBe('false');
    expect(graph.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Select$/ }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 12, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 18, clientY: 10 });
    fireEvent.pointerCancel(canvas);
    expect(graph.getAttribute('cx')).toBe('12');
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
  });
  it('connects exactly two selected graph nodes and sends the candidate edge to publish', async () => {
    let submitted: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const loadedGraph = { ...session.graph, nodes: session.graph.nodes.map(node => ({ ...node, floorId })) };
      if (!init?.method) return Promise.resolve({ ok: true, json: async () => ({ ...session, graph: loadedGraph, runtimeGraph: loadedGraph }) });
      submitted = JSON.parse(String(init.body));
      const added = ((submitted as Record<string, unknown>).addedEdges as Array<Record<string, unknown>>)[0];
      const graph = { ...loadedGraph, edges: [added] };
      return Promise.resolve({ ok: true, json: async () => ({ saved: true, valid: true, revision: 'saved', graph, runtimeGraph: graph }) });
    }));
    render(<NavigationEditor floorId={floorId} />);
    const first = await screen.findByRole('button', { name: 'Graph node junction' });
    const second = screen.getByRole('button', { name: 'Graph node junction-2' });
    fireEvent.keyDown(first, { key: 'Enter' });
    fireEvent.keyDown(second, { key: 'Enter', shiftKey: true });
    const connect = screen.getByRole('button', { name: 'Connect nodes' });
    expect(connect.hasAttribute('disabled')).toBe(false);
    fireEvent.click(connect);
    await waitFor(() => expect(screen.getAllByRole('application')[0].querySelector('polyline[data-edge]')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain('Accessibility remains unknown');
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await screen.findByText(/Saved source overrides/);
    expect(submitted).toBeDefined();
    const request = submitted as Record<string, unknown>;
    expect(request.action).toBe('save');
    const added = (request.addedEdges as Array<Record<string, unknown>>)[0];
    expect(added).toMatchObject({
      floorId, pathType: 'corridor', accessibility: 'unknown', restriction: 'unknown',
      status: 'candidate', bidirectional: true,
    });
    expect(added.geometry).toEqual([[12, 10], [90, 90]]);
    expect(screen.getByRole('button', { name: 'Connect nodes' }).hasAttribute('disabled')).toBe(true);
  });
  it('merges overlapping junctions with pending branches, undo/redo, restore, preview and post-save export', async () => {
    const point = [40, 40] as [number, number];
    const nodes = ['a', 'b', 'c', 'west', 'east', 'north'].map((id, i) => ({
      id, point: i < 3 ? point : [[5, 40], [90, 40], [40, 5]][i - 3] as [number, number],
      type: 'junction' as const, buildingId: 'B03', floorId, status: 'candidate' as const,
    }));
    const edge = (id: string, from: string, to: string, bidirectional = true) => ({
      id, from, to, floorId, bidirectional, geometry: [nodes.find(n => n.id === from)!.point, [25, 35] as [number, number], nodes.find(n => n.id === to)!.point],
      distance: 45, distanceUnit: 'map-unit' as const, pathType: 'corridor' as const,
      status: 'candidate' as const, accessibility: 'unknown' as const, restriction: 'unknown' as const,
    });
    let loaded = { ...session, config: { reviewedSpineOverrides: [] }, spines: [] as Session['spines'],
      graph: { ...session.graph, nodes, edges: [edge('left', 'west', 'a'), edge('right', 'b', 'east', false)] } } as Session;
    const requests: Record<string, any>[] = [];
    let draft: Record<string, any> = {};
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init?.method) return Promise.resolve({ ok: true, json: async () => ({ ...loaded, runtimeGraph: loaded.graph }) });
      const body = JSON.parse(String(init.body)); requests.push(body);
      const moved = moveGraphNodes(loaded.graph, body.nodeMoves || {});
      const graph = mergeGraphNodes({ ...moved, edges: [...moved.edges, ...(body.addedEdges || []).map((item: any) => ({ ...item, geometry: [moved.nodes.find(n => n.id === item.from)!.point, moved.nodes.find(n => n.id === item.to)!.point] }))] }, body.nodeMerges || {}).graph;
      let result: Record<string, unknown> = { graph, runtimeGraph: graph, revision: 'saved', valid: true };
      if (body.action === 'draft') { draft = body; result = { candidate: 'synthetic-draft', saved: false }; }
      if (body.action === 'restore') result = { ...draft, revision: 'selection-test' };
      if (body.action === 'save') { loaded = { ...loaded, graph }; result.saved = true; }
      return Promise.resolve({ ok: true, json: async () => result });
    }));
    render(<NavigationEditor floorId={floorId} />);
    await screen.findByRole('button', { name: 'Graph node a' });
    const select = (id: string, additive = false) => fireEvent.keyDown(screen.getByRole('button', { name: `Graph node ${id}` }), { key: 'Enter', shiftKey: additive });
    select('c'); select('north', true);
    fireEvent.click(screen.getByRole('button', { name: 'Connect nodes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    select('c'); select('b', true); select('a', true);
    fireEvent.click(screen.getByRole('button', { name: 'Merge nodes' }));
    expect(screen.queryByRole('button', { name: 'Graph node b' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Graph node c' })).toBeNull();
    expect(screen.getByRole('application').querySelectorAll('polyline[data-edge]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Graph node b' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.queryByRole('button', { name: 'Graph node b' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore loaded configuration' }));
    expect(screen.getByRole('button', { name: 'Graph node b' })).toBeTruthy();
    expect(screen.getByRole('application').querySelectorAll('polyline[data-edge]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Graph node b' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Save preview draft' })[0]);
    await waitFor(() => expect(requests.some(r => r.action === 'draft')).toBe(true));
    await screen.findByText(/Preview draft synthetic-draft saved/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.change(screen.getByLabelText('Saved candidate'), { target: { value: 'synthetic-draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore candidate into draft' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Graph node b' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Run in admin' }));
    await screen.findByText(/Admin preview generated/);
    expect(requests.find(r => r.action === 'preview')?.nodeMerges).toEqual({ b: 'a', c: 'a' });
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await screen.findByText(/Saved source overrides/);
    expect(requests.find(r => r.action === 'save')?.nodeMerges).toEqual({ b: 'a', c: 'a' });
    expect(loaded.graph.edges).toHaveLength(3);
    expect(loaded.graph.edges.find(e => e.id === 'right')).toMatchObject({ from: 'a', bidirectional: false });
    fireEvent.click(screen.getByRole('button', { name: 'Preview edited route here' }));
    expect(screen.queryByRole('button', { name: 'Graph node b' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
    select('a');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Graph node a' }), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Preview edited route here' }));
    expect(screen.getByRole('button', { name: 'Graph node a' }).getAttribute('cx')).toBe('41');
  });
});
