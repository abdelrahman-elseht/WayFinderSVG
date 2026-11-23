// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NavigationEditor from '../../apps/web/components/admin/NavigationEditor';
import { anchoredEdgeGeometryEdits, applyEdgeGeometryEdits, applyRoomEntryBindings, authoringPayload, emptyAuthoringEdits, type AuthoringEdits, type Session } from '../../apps/web/components/admin/editor-model';

const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => matrix };
const sourceForFloor = (floorId: 'GF' | '01') => `maps/B03/${floorId}/master.svg`;
const source = sourceForFloor('GF');
const review = 'Reviewed against the supplied floor drawing, access unconfirmed.';

function fixture(floorId: 'GF' | '01') {
  const floorSource = sourceForFloor(floorId);
  const nodes = [
    { id: 'west', buildingId: 'B03', floorId, point: [10, 50], type: 'junction', status: 'candidate' },
    { id: 'east', buildingId: 'B03', floorId, point: [90, 50], type: 'junction', status: 'candidate' },
  ];
  const edge = { id: 'corridor', from: 'west', to: 'east', floorId, pathType: 'corridor', distance: 80, distanceUnit: 'map-unit', accessibility: 'confirmed', restriction: 'unknown', status: 'candidate', bidirectional: false, geometry: [[10, 50], [90, 50]] };
  const graph = { nodes, edges: [edge], walls: [], navigableAreas: [[[5, 5], [95, 5], [95, 95], [5, 95]]], routingPolicy: 'drawing-based', status: 'candidate', metersPerUnit: null, calibrationStatus: 'unknown' };
  return {
    revision: 'authoring-test', spines: [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[10, 50], [90, 50]], sourceReferences: [floorSource] }],
    floor: { floor: { id: floorId, viewBox: [0, 0, 100, 100], mapAsset: `/maps/B03/${floorId}/master.svg` }, rooms: [{ id: 'lab', code: 'LAB', floorId, name: { en: 'Laboratory', ar: 'Lab' }, doorNodeId: 'west', navigationPartial: true, navigationNote: { en: 'Original caveat.', ar: 'Original caveat.' } }] },
    graph, runtimeGraph: graph, config: { reviewedSpineOverrides: [] }, evidence: [], candidates: ['draft-test'], authoringSourceReferences: [floorSource],
  } as unknown as Session;
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return this; } });
  Object.defineProperties(SVGElement.prototype, {
    getScreenCTM: { configurable: true, value: () => matrix },
    setPointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => false },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function setup(floorId: 'GF' | '01', restored: Partial<AuthoringEdits> = emptyAuthoringEdits(), transitionCandidates: Session['transitionCandidates'] = []) {
  const loaded = fixture(floorId);
  loaded.transitionCandidates = transitionCandidates;
  const requests: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    if (!init?.method) return Promise.resolve({ ok: true, json: async () => loaded });
    const body = JSON.parse(String(init.body)); requests.push(body);
    if (body.action === 'restore') return Promise.resolve({ ok: true, json: async () => ({ spines: loaded.spines, ...restored }) });
    if (body.action === 'save') {
      const added = body.addedNodes || [];
      const graph = { ...loaded.graph, nodes: [...loaded.graph.nodes, ...added.map((node: Record<string, unknown>) => ({ ...node, adminReview: { kind: 'admin-drawing-review' } }))], edges: [...loaded.graph.edges, ...body.addedEdges] };
      const floor = { ...loaded.floor, rooms: loaded.floor.rooms.map(room => ({ ...room, doorNodeId: body.roomEntryBindings.find((binding: { roomId: string }) => binding.roomId === room.id)?.nodeId || room.doorNodeId })) };
      return Promise.resolve({ ok: true, json: async () => ({ saved: true, revision: 'published', graph, runtimeGraph: graph, floor }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ valid: true, candidate: body.action === 'draft' ? 'draft-new' : undefined, graph: loaded.graph, floor: loaded.floor }) });
  }));
  render(<NavigationEditor floorId={floorId} />);
  await screen.findByRole('button', { name: 'Graph node west' });
  const canvas = screen.getByRole('application');
  const clickMap = (x: number, y: number) => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(canvas, { button: 0, clientX: x, clientY: y, pointerId: 1 });
  };
  const setReview = () => {
    fireEvent.click(screen.getByText('Use different source evidence'));
    fireEvent.change(screen.getByLabelText('Authoring source reference'), { target: { value: sourceForFloor(floorId) } });
    fireEvent.click(screen.getByText('Review note'));
    fireEvent.change(screen.getByLabelText('Authoring review note'), { target: { value: review } });
  };
  const saveDraft = async () => {
    const before = requests.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Save preview draft' })[0]);
    await waitFor(() => expect(requests.length).toBe(before + 1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run in admin' }).hasAttribute('disabled')).toBe(false));
    return requests.at(-1)!;
  };
  return { canvas, loaded, requests, clickMap, setReview, saveDraft };
}

describe.each(['GF', '01'] as const)('admin-authoring interactions on %s', floorId => {
  it('puts transition setup one click away and focuses its first choice', async () => {
    await setup(floorId);
    fireEvent.click(screen.getByRole('button', { name: 'Set up lift / escalator' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Transition kind')));
  });

  it('uses the visible floor drawing without opening or choosing a path', async () => {
    const { clickMap, requests } = await setup(floorId);
    expect(screen.getByText('Use different source evidence').closest('details')!.open).toBe(false);
    fireEvent.change(screen.getByLabelText('Transition name'), { target: { value: 'Main escalator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place landing on drawing' }));
    expect((screen.getByLabelText('Walkable areas visibility') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Click inside the green walkable area/).textContent).toContain('inside the green walkable area');
    clickMap(70, 50);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].addedNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'escalator', sourceReference: sourceForFloor(floorId),
        note: expect.stringContaining('Position selected in the admin editor'),
      }),
    ]));
  });

  it('rejects transition landings outside supported walkable areas before saving', async () => {
    const { clickMap, requests } = await setup(floorId);
    fireEvent.change(screen.getByLabelText('Transition name'), { target: { value: 'Main escalator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place landing on drawing' }));
    clickMap(2, 50);
    expect(screen.queryByRole('button', { name: /Graph node B03-.*admin-node-/ })).toBeNull();
    expect(document.querySelector('.editor-status')?.textContent).toContain('Do not add a walkable mask to extend this area.');
    expect(requests).toHaveLength(0);
  });

  it('requires source review, finishes/edits/subtracts masks, cancels without changes and supports undo/redo', async () => {
    const { canvas, requests, clickMap, setReview, saveDraft } = await setup(floorId);
    fireEvent.click(screen.getByRole('button', { name: 'Start walkable polygon' }));
    clickMap(20, 10); clickMap(40, 10); clickMap(40, 30);
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toContain('review note');
    fireEvent.click(screen.getByRole('button', { name: 'Run in admin' }));
    expect(requests).toHaveLength(0);
    setReview();
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Edit draft mask' }));
    fireEvent.change(screen.getByLabelText('Mask vertex 1 X'), { target: { value: 22 } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel mask' }));
    expect(canvas.querySelector('[data-mask]')?.getAttribute('points')).toBe('20,10 40,10 40,30');
    fireEvent.click(screen.getByRole('button', { name: 'Edit draft mask' }));
    fireEvent.change(screen.getByLabelText('Mask vertex 1 X'), { target: { value: 22 } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    expect(canvas.querySelector('[data-mask]')?.getAttribute('points')).toBe('22,10 40,10 40,30');
    fireEvent.change(screen.getByLabelText('Walkable mask operation'), { target: { value: 'subtract' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start walkable polygon' }));
    clickMap(25, 15); clickMap(35, 15); clickMap(35, 25);
    fireEvent.click(screen.getByRole('button', { name: 'Finish walkable mask' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(2);
    const payload = await saveDraft();
    expect(payload.navigableAreaEdits).toEqual([
      expect.objectContaining({ operation: 'add', polygon: [[22, 10], [40, 10], [40, 30]], sourceReference: sourceForFloor(floorId), note: review }),
      expect.objectContaining({ operation: 'subtract', polygon: [[25, 15], [35, 15], [35, 25]], sourceReference: sourceForFloor(floorId), note: review }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Restore loaded configuration' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Save preview draft' })[0].hasAttribute('disabled')).toBe(true);
  });

  it('places/moves/connects junctions and room approaches, keeps candidates distinct, then clears overlays after publish', async () => {
    const { canvas, clickMap, setReview, requests } = await setup(floorId);
    setReview();
    fireEvent.click(screen.getByRole('button', { name: 'Place junction' })); clickMap(40, 50);
    let additions = screen.getAllByRole('button', { name: /Graph node B03-.*admin-node-/ });
    const junctionId = additions[0].getAttribute('data-node')!;
    expect(additions[0].getAttribute('data-node-role')).toBe('junction');
    fireEvent.change(screen.getByLabelText('Graph node X'), { target: { value: 45 } });
    fireEvent.click(screen.getByRole('button', { name: 'Place room approach' })); clickMap(55, 50);
    additions = screen.getAllByRole('button', { name: /Graph node B03-.*admin-node-/ });
    const entry = additions.find(element => element.getAttribute('data-node') !== junctionId)!;
    const entryId = entry.getAttribute('data-node')!;
    expect(entry.getAttribute('data-node-role')).toBe('room-approach');
    fireEvent.keyDown(screen.getByRole('button', { name: `Graph node ${junctionId}` }), { key: 'Enter', shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Connect nodes' }));
    fireEvent.change(screen.getByLabelText('Node type'), { target: { value: 'candidate-entry' } });
    expect(screen.queryByRole('button', { name: `Graph node ${junctionId}` })).toBeNull();
    expect(screen.getByRole('button', { name: `Graph node ${entryId}` })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    const body = requests[0];
    expect(body.addedNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: junctionId, point: [45, 50], status: 'candidate', type: 'junction', sourceReference: sourceForFloor(floorId), note: review }),
      expect.objectContaining({ id: entryId, point: [55, 50], status: 'candidate', type: 'entrance', roomId: 'lab' }),
    ]));
    expect(body.nodeMoves).toEqual({});
    expect(body.roomEntryBindings).toEqual([expect.objectContaining({ roomId: 'lab', nodeId: entryId })]);
    expect(body.addedEdges).toEqual([expect.objectContaining({ accessibility: 'unknown', status: 'candidate', from: expect.any(String), to: expect.any(String) })]);
    await waitFor(() => expect(screen.getByText('Draft: 0 nodes, 0 room bindings, 0 masks, 0 edge edits.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
    expect(canvas.querySelector(`[data-node="${entryId}"]`)).toBeTruthy();
  });

  it('places a named candidate escalator landing for a later opposite-floor pair', async () => {
    const { clickMap, setReview, requests } = await setup('GF');
    setReview();
    fireEvent.change(screen.getByLabelText('Transition name'), { target: { value: 'Main escalator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place landing on drawing' }));
    clickMap(70, 50);
    const landing = screen.getByRole('button', { name: /Graph node B03-GF-admin-node-/ });
    expect(landing.getAttribute('data-node-role')).toBe('escalator');
    expect(screen.getByRole('button', { name: 'Multi-select' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Graph node east' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Connect nodes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].addedNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'escalator', transitionName: 'Main escalator', transitionAccessibility: 'unknown',
        transitionRestriction: 'unknown', transitionId: expect.stringMatching(/^B03-transition-/),
      }),
    ]));
    expect(requests[0].addedEdges).toEqual([expect.objectContaining({ from: expect.any(String), to: 'east' })]);
  });

  it('reuses the saved opposite-floor transition identity when placing the paired lift landing', async () => {
    const candidate = { transitionId: 'B03-transition-test', transitionName: 'Service lift', type: 'elevator' as const,
      transitionAccessibility: 'confirmed' as const, transitionRestriction: 'open' as const, floorId: 'GF', id: 'B03-GF-admin-node-lift' };
    const { clickMap, setReview, requests } = await setup('01', emptyAuthoringEdits(), [candidate]);
    setReview();
    fireEvent.change(screen.getByLabelText('Transition kind'), { target: { value: 'elevator' } });
    fireEvent.change(screen.getByLabelText('Pair with landing'), { target: { value: candidate.transitionId } });
    fireEvent.click(screen.getByRole('button', { name: 'Place landing on drawing' }));
    clickMap(70, 50);
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].addedNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'elevator', transitionId: candidate.transitionId, transitionName: candidate.transitionName,
        transitionAccessibility: 'confirmed', transitionRestriction: 'open',
      }),
    ]));
  });

  it('selects graph edges, edits anchored bends, cancels, and submits edited geometry without changing direction', async () => {
    const { canvas, clickMap, saveDraft, setReview } = await setup(floorId);
    setReview();
    fireEvent.change(screen.getByLabelText('Inspect graph edge'), { target: { value: 'corridor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit edge bends' }));
    expect(screen.getByLabelText('Edge point 0 X').hasAttribute('disabled')).toBe(true);
    clickMap(50, 40);
    fireEvent.change(screen.getByLabelText('Edge point 1 Y'), { target: { value: 35 } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel bends' }));
    expect(canvas.querySelector('[data-testid="active-edge-bends"]')).toBeNull();
    expect(canvas.querySelector('[data-edge="corridor"]')?.getAttribute('points')).toBe('10,50 90,50');
    fireEvent.click(screen.getByRole('button', { name: 'Edit edge bends' }));
    clickMap(50, 40);
    fireEvent.click(screen.getByRole('button', { name: 'Finish edge bends' }));
    expect(canvas.querySelector('[data-edge="corridor"]')?.getAttribute('points')).toBe('10,50 50,40 90,50');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Graph node west' }), { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Graph node X'), { target: { value: 15 } });
    const body = await saveDraft();
    expect(body.edgeGeometryEdits).toEqual({ corridor: { geometry: [[15, 50], [50, 40], [90, 50]], sourceReference: sourceForFloor(floorId), note: review } });
    expect(body.addedEdges).toEqual([]);
    expect(canvas.querySelector('[data-edge="corridor"]')?.getAttribute('points')).toBe('15,50 50,40 90,50');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(canvas.querySelector('[data-edge="corridor"]')?.getAttribute('points')).toBe('10,50 90,50');
  });

  it('restores all four collections, previews and resets them', async () => {
    const edits = emptyAuthoringEdits();
    edits.addedNodes = [{ id: `B03-${floorId}-admin-node-test`, buildingId: 'B03', floorId, point: [50, 50], type: 'entrance', status: 'candidate', roomId: 'lab', sourceReference: sourceForFloor(floorId), note: review }];
    edits.roomEntryBindings = [{ roomId: 'lab', nodeId: edits.addedNodes[0].id, sourceReference: sourceForFloor(floorId), note: review }];
    edits.navigableAreaEdits = [{ id: 'mask', operation: 'subtract', polygon: [[20, 10], [30, 10], [30, 20]], sourceReference: sourceForFloor(floorId), note: review }];
    edits.edgeGeometryEdits = { corridor: { geometry: [[10, 50], [50, 45], [90, 50]], sourceReference: sourceForFloor(floorId), note: review } };
    const { requests, canvas, saveDraft } = await setup(floorId, edits);
    fireEvent.change(screen.getByLabelText('Saved candidate'), { target: { value: 'draft-test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore candidate into draft' }));
    await screen.findByText('Draft: 1 nodes, 1 room bindings, 1 masks, 1 edge edits.');
    const body = await saveDraft();
    for (const key of Object.keys(edits) as Array<keyof AuthoringEdits>) expect(body[key]).toEqual(edits[key]);
    fireEvent.click(screen.getByRole('button', { name: 'Run in admin' }));
    await waitFor(() => expect(requests.at(-1)?.action).toBe('preview'));
    expect(requests.at(-1)).toMatchObject(edits);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run in admin' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Restore loaded configuration' }));
    expect(canvas.querySelectorAll('[data-mask]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: `Graph node ${edits.addedNodes[0].id}` })).toBeNull();
    expect(screen.getByText('Draft: 0 nodes, 0 room bindings, 0 masks, 0 edge edits.')).toBeTruthy();
  });

  it('removes a pending node and its endpoint binding without sending an unknown tombstone', async () => {
    const { setReview, clickMap, saveDraft } = await setup(floorId);
    setReview(); fireEvent.click(screen.getByRole('button', { name: 'Place room approach' })); clickMap(50, 50);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(screen.getByText('Draft: 0 nodes, 0 room bindings, 0 masks, 0 edge edits.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Place junction' })); clickMap(60, 50);
    const body = await saveDraft();
    expect(body.deletedNodes).toEqual([]);
    expect(body.roomEntryBindings).toEqual([]);
    expect(body.addedNodes).toHaveLength(1);
  });

  it('replaces current authoring with empty collections when restoring a legacy draft', async () => {
    const { setReview, clickMap, saveDraft } = await setup(floorId, {});
    setReview(); fireEvent.click(screen.getByRole('button', { name: 'Place junction' })); clickMap(50, 50);
    expect(screen.getByText('Draft: 1 nodes, 0 room bindings, 0 masks, 0 edge edits.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Saved candidate'), { target: { value: 'draft-test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore candidate into draft' }));
    await screen.findByText('Draft: 0 nodes, 0 room bindings, 0 masks, 0 edge edits.');
    fireEvent.click(screen.getByRole('button', { name: 'Place junction' })); clickMap(60, 50);
    const body = await saveDraft();
    expect(body.addedNodes).toHaveLength(1);
    expect(body.navigableAreaEdits).toEqual([]);
    expect(body.roomEntryBindings).toEqual([]);
    expect(body.edgeGeometryEdits).toEqual({});
  });

  it('retains all authoring history and displays backend rejection without pretending to publish', async () => {
    const { setReview, clickMap } = await setup(floorId);
    setReview(); fireEvent.click(screen.getByRole('button', { name: 'Place junction' })); clickMap(50, 50);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Authored connection touches a supplied wall: corridor' }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('touches a supplied wall'));
    expect(screen.getByText('Draft: 1 nodes, 0 room bindings, 0 masks, 0 edge edits.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Save preview draft' })[0].hasAttribute('disabled')).toBe(false);
  });
});

it('normalizes pending-node coordinates without mutating stored history', () => {
  const edits = emptyAuthoringEdits();
  edits.addedNodes.push({ id: 'new', buildingId: 'B03', floorId: 'GF', point: [1, 2], type: 'junction', status: 'candidate', sourceReference: source, note: review });
  expect(authoringPayload(edits, { new: [3, 4] }).addedNodes[0].point).toEqual([3, 4]);
  expect(edits.addedNodes[0].point).toEqual([1, 2]);
});

it('anchors bend payloads, preserves edge direction and retains candidate/unknown qualifications', () => {
  const loaded = fixture('GF');
  const edits = { corridor: { geometry: [[0, 0], [50, 30], [100, 100]] as [number, number][], sourceReference: source, note: review } };
  const anchored = anchoredEdgeGeometryEdits(loaded.graph, edits);
  expect(anchored.corridor).toEqual({ geometry: [[10, 50], [50, 30], [90, 50]], sourceReference: source, note: review });
  const overlay = applyEdgeGeometryEdits(loaded.graph, anchored);
  expect(overlay.edges[0]).toMatchObject({ id: 'corridor', from: 'west', to: 'east', bidirectional: false, status: 'candidate', accessibility: 'unknown' });
  expect(loaded.graph.edges[0].accessibility).toBe('confirmed');
  const floor = applyRoomEntryBindings(loaded.floor, [{ roomId: 'lab', nodeId: 'new', sourceReference: source, note: review }]);
  expect(floor.rooms[0]).toMatchObject({ doorNodeId: 'new', navigationPartial: true });
  expect(floor.rooms[0].navigationNote?.en).toContain('Original caveat.');
  expect(floor.rooms[0].navigationNote?.en).toContain('wheelchair accessibility remain unconfirmed');
  expect(floor.rooms[0].navigationNote?.ar).toContain('Original caveat.');
});
