// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NavigationEditor from '../../apps/web/components/admin/NavigationEditor';
import type { Session } from '../../apps/web/components/admin/editor-model';

const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => matrix };
const vertices = [[20, 10], [70, 10], [70, 40]];
const warning = 'Finish or cancel the active polygon/bend drawing before previewing or saving.';

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return this; } });
  Object.defineProperties(SVGElement.prototype, {
    getScreenCTM: { configurable: true, value: () => matrix },
    setPointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => false },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function setup(floorId: 'GF' | '01') {
  const source = `maps/B03/${floorId}/master.svg`;
  const graph = { nodes: [
    { id: 'west', buildingId: 'B03', floorId, point: [10, 80], type: 'junction', status: 'candidate' },
    { id: 'east', buildingId: 'B03', floorId, point: [90, 80], type: 'junction', status: 'candidate' },
  ], edges: [{ id: 'edge', from: 'west', to: 'east', floorId, geometry: [[10, 80], [90, 80]], distance: 80 }],
  walls: [], navigableAreas: [[[0, 0], [100, 0], [100, 100], [0, 100]]] };
  const loaded = { revision: 'drawing-state', graph, runtimeGraph: graph, evidence: [], candidates: [], config: {},
    spines: [], authoringSourceReferences: [source],
    floor: { floor: { id: floorId, viewBox: [0, 0, 100, 100], mapAsset: '/map.svg' }, rooms: [] },
  } as unknown as Session;
  const requests: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    if (!init?.method) return Promise.resolve({ ok: true, json: async () => loaded });
    requests.push(JSON.parse(String(init.body)));
    return Promise.resolve({ ok: true, json: async () => ({ valid: true, graph, saved: requests.at(-1)?.action === 'save', revision: 'saved' }) });
  }));
  render(<NavigationEditor floorId={floorId} />);
  await screen.findByRole('button', { name: 'Graph node west' });
  const canvas = screen.getByRole('application');
  const clickMap = (x: number, y: number) => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(canvas, { button: 0, clientX: x, clientY: y, pointerId: 1 });
    fireEvent.click(canvas, { clientX: x, clientY: y });
  };
  const review = () => {
    fireEvent.change(screen.getByLabelText('Authoring source reference'), { target: { value: source } });
    fireEvent.change(screen.getByLabelText('Authoring review note'), { target: { value: 'Test fixture administrator review, access unknown.' } });
  };
  const draw = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start walkable polygon' }));
    vertices.forEach(([x, y]) => clickMap(x, y));
  };
  return { canvas, clickMap, requests, review, draw, source };
}

describe.each(['GF', '01'] as const)('polygon completion state on %s', floorId => {
  it.each(['first vertex', 'double-click', 'Enter', 'Finish button'])('closes with %s, clears the pending state and publishes exactly one mask', async method => {
    const { canvas, clickMap, requests, review, draw } = await setup(floorId);
    // Reproduce the screenshot's unrelated "1 selected" count during authoring.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Graph node west' }), { key: 'Enter' });
    review(); draw();
    expect(screen.getByText('Draw walkable mask / 1 selected')).toBeTruthy();
    if (method === 'first vertex') {
      clickMap(20, 10);
      // Remaining browser click/double-click events must not restart a draft.
      clickMap(20, 10);
      fireEvent.doubleClick(canvas, { clientX: 20, clientY: 10 });
    }
    if (method === 'double-click') {
      clickMap(70, 40);
      fireEvent.doubleClick(canvas, { clientX: 70, clientY: 40 });
    }
    if (method === 'Enter') fireEvent.keyDown(canvas, { key: 'Enter' });
    if (method === 'Finish button') fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    expect(screen.queryByTestId('active-mask-polygon')).toBeNull();
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(1);
    expect((screen.getAllByRole('button', { name: 'Save preview draft' })[0] as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Save and publish' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ action: 'save', navigableAreaEdits: [expect.objectContaining({ polygon: vertices })] });
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes(warning))).toBe(false);
  });

  it('keeps a visually unfinished polygon blocked for preview and both saves, even with a committed mask selected', async () => {
    const { canvas, requests, review, draw, clickMap } = await setup(floorId);
    review(); draw();
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    const selected = screen.getByLabelText<HTMLSelectElement>('Draft walkable mask').value;
    fireEvent.click(screen.getByRole('button', { name: 'Start walkable polygon' }));
    clickMap(30, 20);
    expect(screen.getByLabelText<HTMLSelectElement>('Draft walkable mask').value).toBe(selected);
    expect(screen.getByTestId('active-mask-polygon').tagName.toLowerCase()).toBe('polyline');
    for (const name of ['Run in admin', 'Save preview draft', 'Save and publish']) {
      fireEvent.click(screen.getAllByRole('button', { name })[0]);
      expect(screen.getByRole('alert').textContent).toContain('3-256 finite polygon vertices');
      expect(requests).toHaveLength(0);
      expect(screen.getByTestId('active-mask-polygon').getAttribute('points')).toBe('30,20');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Cancel mask' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Run in admin' }));
    await waitFor(() => expect(requests).toHaveLength(1));
  });

  it('does not discard a closed attempt when required source evidence is missing', async () => {
    const { requests, draw, clickMap, review } = await setup(floorId);
    draw(); clickMap(20, 10);
    expect(screen.getByTestId('active-mask-polygon').getAttribute('points')).toBe('20,10 70,10 70,40');
    expect(screen.getByRole('status').textContent).toContain('source evidence');
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    expect(requests).toHaveLength(0);
    review(); fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' });
    expect(screen.queryByTestId('active-mask-polygon')).toBeNull();
  });

  it.each([
    ['Save and publish', 'save'], ['Save preview draft', 'draft'], ['Run in admin', 'preview'],
  ])('finishes a pending polygon in the same %s request without explicit Finish', async (button, action) => {
    const { canvas, requests, review, draw, clickMap, source } = await setup(floorId);
    review(); draw();
    clickMap(70, 40);
    expect(screen.getByTestId('active-mask-polygon').getAttribute('points')).toBe('20,10 70,10 70,40');
    expect((screen.getAllByRole('button', { name: 'Save preview draft' })[0] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Source unchanged/)).toBeNull();
    expect(screen.getAllByText('Pending drawing: 3 mask vertices').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: button })[0]);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ floorId, action, navigableAreaEdits: [expect.objectContaining({ polygon: vertices, sourceReference: source, note: 'Test fixture administrator review, access unknown.' })] });
    expect(requests[0].navigableAreaEdits).toHaveLength(1);
    expect(screen.queryByTestId('active-mask-polygon')).toBeNull();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save and publish' }) as HTMLButtonElement).disabled).toBe(false));
    if (action !== 'save') {
      expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(1);
      fireEvent.keyDown(canvas, { key: 'Enter' });
      fireEvent.doubleClick(canvas, { clientX: 70, clientY: 40 });
      fireEvent.click(screen.getAllByRole('button', { name: 'Save preview draft' })[0]);
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1].navigableAreaEdits).toHaveLength(1);
    }
  });

  it.each(['Save and publish', 'Save preview draft', 'Run in admin'])('retains missing provenance and focuses its supplied field on %s', async button => {
    const { requests, draw, source } = await setup(floorId);
    draw();
    fireEvent.click(screen.getByRole('button', { name: /Collapse layers/ }));
    fireEvent.click(screen.getAllByRole('button', { name: button })[0]);
    expect(requests).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('Choose supplied floor source evidence');
    expect(screen.getByRole('button', { name: /Collapse layers/ }).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Authoring source reference'));
    fireEvent.change(screen.getByLabelText('Authoring source reference'), { target: { value: source } });
    fireEvent.click(screen.getAllByRole('button', { name: button })[0]);
    expect(requests).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('review note (1-2000 characters)');
    expect(document.activeElement).toBe(screen.getByLabelText('Authoring review note'));
    expect(screen.getByTestId('active-mask-polygon').getAttribute('points')).toBe('20,10 70,10 70,40');
    fireEvent.change(screen.getByLabelText('Authoring review note'), { target: { value: '  Reviewed with unknown access.  ' } });
    fireEvent.click(screen.getAllByRole('button', { name: button })[0]);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].navigableAreaEdits).toEqual([expect.objectContaining({ note: 'Reviewed with unknown access.', sourceReference: source })]);
  });

  it.each(['Save and publish', 'Save preview draft', 'Run in admin'])('retains short and collinear polygons with specific errors on %s', async button => {
    const { requests, review, clickMap } = await setup(floorId);
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Start walkable polygon' }));
    clickMap(20, 10); clickMap(40, 10);
    fireEvent.click(screen.getAllByRole('button', { name: button })[0]);
    expect(screen.getByRole('alert').textContent).toContain('3-256 finite polygon vertices');
    expect(screen.getByTestId('active-mask-polygon').getAttribute('points')).toBe('20,10 40,10');
    clickMap(70, 10);
    fireEvent.click(screen.getAllByRole('button', { name: button })[0]);
    expect(screen.getByRole('alert').textContent).toContain('non-zero area');
    expect(screen.getByTestId('active-mask-polygon').getAttribute('points')).toBe('20,10 40,10 70,10');
    expect(requests).toHaveLength(0);
  });

  it('keeps drawing controls outside both collapsed sidebars and cancels without a request', async () => {
    const { requests, draw } = await setup(floorId);
    draw();
    fireEvent.click(screen.getByRole('button', { name: /Collapse layers/ }));
    fireEvent.click(screen.getByRole('button', { name: /Collapse inspector/ }));
    const bar = screen.getByRole('region', { name: 'Walkable mask drawing controls' });
    expect(bar.closest('aside')).toBeNull();
    expect(within(bar).getByText('Pending drawing: 3 mask vertices')).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Finish walkable mask' })).toBeTruthy();
    fireEvent.click(within(bar).getByRole('button', { name: 'Cancel mask' }));
    expect(screen.queryByTestId('active-mask-polygon')).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('does not finish while Enter is used in note, coordinate or source-picker inputs', async () => {
    const { requests, review, draw } = await setup(floorId);
    review(); draw();
    for (const label of ['Authoring review note', 'Mask vertex 1 X', 'Search source evidence', 'Authoring source reference']) {
      fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
      expect(screen.getByTestId('active-mask-polygon')).toBeTruthy();
    }
    expect(requests).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' });
    fireEvent.doubleClick(screen.getByRole('application'), { clientX: 70, clientY: 40 });
    expect(screen.getByRole('application').querySelectorAll('[data-mask]')).toHaveLength(1);
  });

  it('finishes an edited selected polygon, while unfinished bend edits still block saving', async () => {
    const { requests, draw, review } = await setup(floorId);
    review(); draw();
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit draft mask' }));
    fireEvent.change(screen.getByLabelText('Mask vertex 1 X'), { target: { value: 22 } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    expect(screen.queryByTestId('active-mask-polygon')).toBeNull();
    fireEvent.change(screen.getByLabelText('Inspect graph edge'), { target: { value: 'edge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit edge bends' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    expect(requests).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toContain(warning);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel bends' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save preview draft' })[0]);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].navigableAreaEdits).toEqual([expect.objectContaining({ polygon: [[22, 10], [70, 10], [70, 40]] })]);
  });
});
