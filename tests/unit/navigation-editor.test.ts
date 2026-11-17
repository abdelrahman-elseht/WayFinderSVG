import { describe, expect, it } from 'vitest';
import { coincidenceClusters, controls, deleteControls, exportConfig, graphEditPayload, inside, mergeGraphNodes, mergeSourceLinks, moveGraphNodes, nextCoincidenceMember, pickHandles, propagateSourceLinks, rectangleSelection, selectHandle, selectionStats, translate, translateSelection, type PickHandle, type Session, type Spine } from '../../apps/web/components/admin/editor-model';
import { adminAuthorized } from '../../apps/web/lib/admin-auth';
import type { NavigationGraph } from '@wayfinding/map-engine';

const spines: Spine[] = [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[0, 0], [10.3, 10.7], [20.8, 15.2], [30, 30]], sourceReferences: ['source'] }];
describe('navigation source editor', () => {
  it('picks in CSS pixels at zoom, pan, reflection, rotation and nonuniform/skewed transforms', () => {
    const handle: PickHandle = { id: 'source', kind: 'source', point: [20, 30], visible: true, locked: false, selectable: true };
    for (const matrix of [
      { a: .05, b: 0, c: 0, d: .05, e: 100, f: -40 },
      { a: 8, b: 0, c: 0, d: 8, e: -20, f: 70 },
      { a: 0, b: 2, c: -3, d: 0, e: 120, f: 300 },
      { a: -2, b: 1, c: .7, d: 4, e: -25, f: 60 },
    ]) {
      const x = matrix.a * 20 + matrix.c * 30 + matrix.e, y = matrix.b * 20 + matrix.d * 30 + matrix.f;
      expect(pickHandles([handle], [x + 6, y + 8], matrix)).toEqual([handle]);
      expect(pickHandles([handle], [x + 6.01, y + 8], matrix)).toEqual([]);
    }
  });
  it('deterministically orders overlapping candidates and excludes ineligible handles', () => {
    const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const handles: PickHandle[] = ['z', 'b', 'a'].map(id => ({ id, kind: id === 'z' ? 'graph' : 'source', point: [0, 0], visible: true, locked: false, selectable: true }));
    handles.push({ ...handles[0], id: 'nearby', point: [4, 0] }, { ...handles[0], id: 'locked', locked: true }, { ...handles[0], id: 'hidden', visible: false }, { ...handles[0], id: 'disabled', selectable: false });
    expect(pickHandles(handles, [0, 0], matrix).map(h => h.id)).toEqual(['a', 'b', 'z', 'nearby']);
    expect(pickHandles([...handles].reverse(), [0, 0], matrix).map(h => h.id)).toEqual(['a', 'b', 'z', 'nearby']);
    expect(pickHandles(handles, [0, 0], { ...matrix, a: 0 })).toEqual([]);
    expect(pickHandles(handles, [NaN, 0], matrix)).toEqual([]);
  });
  it('cycles one target without losing other selected objects or collapsing an existing group', () => {
    const source = { id: 'a', kind: 'source' as const, point: [0, 0] as [number, number] };
    const graph = { id: 'z', kind: 'graph' as const, point: [0, 0] as [number, number] };
    expect(selectHandle(new Set(['a', 'other']), new Set(), graph, false, source)).toEqual({ sources: new Set(['other']), nodes: new Set(['z']) });
    expect(selectHandle(new Set(['a', 'other']), new Set(['z']), graph, false, source)).toEqual({ sources: new Set(['a', 'other']), nodes: new Set(['z']) });
    expect(selectHandle(new Set(['a']), new Set(['z']), source, true)).toEqual({ sources: new Set(), nodes: new Set(['z']) });
  });
  it('sends the complete absolute overlay while distinguishing explicit intent', () => {
    expect(graphEditPayload({})).toEqual({ nodeMoves: {}, explicitNodeMoves: {} });
    expect(graphEditPayload({ junction: [1, 2] })).toEqual({
      nodeMoves: { junction: [1, 2] }, explicitNodeMoves: { junction: [1, 2] },
    });
    expect(graphEditPayload({ junction: [1, 2] }, { linked: [3, 4], junction: [9, 9] })).toEqual({
      nodeMoves: { linked: [3, 4], junction: [1, 2] }, explicitNodeMoves: { junction: [1, 2] },
    });
  });
  it('clusters coincident handles with stable source-before-graph ordering', () => {
    const clusters = coincidenceClusters([
      { id: 'z', kind: 'graph', point: [10, 10] }, { id: 'b', kind: 'source', point: [10.2, 10.1] },
      { id: 'a', kind: 'source', point: [50, 50] },
    ], 0.5);
    expect(clusters).toHaveLength(2);
    const overlap = clusters.find(cluster => cluster.members.some(member => member.id === 'b'))!;
    expect(overlap.members.map(member => member.id)).toEqual(['b', 'z']);
    expect(nextCoincidenceMember(overlap).id).toBe('b');
    expect(nextCoincidenceMember(overlap, 'b').id).toBe('z');
    expect(coincidenceClusters([
      { id: 'a', kind: 'source', point: [0, 0] }, { id: 'b', kind: 'source', point: [.4, 0] }, { id: 'c', kind: 'graph', point: [.8, 0] },
    ], .5)[0].members.map(member => member.id)).toEqual(['a', 'b', 'c']);
  });
  it('exports floor configs without reviewedConnections and preserves defined connection values', () => {
    const base = { revision: 'r', spines, floor: {} as Session['floor'], graph: {} as NavigationGraph,
      runtimeGraph: {} as NavigationGraph, evidence: [], candidates: [] };
    const firstFloor = exportConfig({ ...base, config: { reviewedSpineOverrides: [] } } as Session, spines);
    expect(firstFloor).toEqual({ reviewedSpineOverrides: [] });
    const connection = { id: 'connection:x', index: 1, kind: 'connection' as const,
      coordinates: [[0, 0], [10, 0]] as [number, number][], sourceReferences: ['evidence'], note: 'kept' };
    const gf = exportConfig({ ...base, spines: [connection], config: { reviewedConnections: [{ id: 'x', coordinates: [[0, 0], [10, 0]], sourceReferences: ['original'], note: 'kept metadata' }] } } as Session,
    [{ ...connection, coordinates: [[0, 1], [10, 1]] }]);
    expect(gf.reviewedConnections).toEqual([{ id: 'x', coordinates: [[0, 1], [10, 1]], sourceReferences: ['original'], note: 'kept metadata' }]);
  });
  it('merges only compatible coincident junctions and keeps directed, parallel, and evidence-distinct routes', () => {
    const node = (id: string, point: [number, number]) => ({ id, point, type: 'junction' as const, floorId: '01', buildingId: 'B03', status: 'candidate' as const });
    const edge = (id: string, from: string, to: string, bidirectional = true, accessibility: 'unknown' | 'confirmed' = 'unknown') => ({
      id, from, to, floorId: '01', pathType: 'corridor' as const, distance: 10, distanceUnit: 'map-unit' as const,
      accessibility, restriction: 'unknown' as const, status: 'candidate' as const, bidirectional,
      geometry: [[0, 0], [10, 0]] as [number, number][],
    });
    const graph = { nodes: [node('a', [10, 10]), node('b', [10, 10]), node('c', [10, 10]),
      node('west', [0, 10]), node('east', [20, 10])],
      edges: [edge('west-a', 'west', 'a'), edge('west-b', 'west', 'b'), edge('west-c', 'west', 'c'),
        edge('east-a', 'a', 'east', false), edge('east-c', 'c', 'east', false, 'confirmed'),
        edge('internal', 'b', 'c')].map(item => {
          const points: Record<string, [number, number]> = { a: [10, 10], b: [10, 10], c: [10, 10], west: [0, 10], east: [20, 10] };
          return { ...item, geometry: [points[item.from], points[item.to]], distance: Math.hypot(points[item.from][0] - points[item.to][0], points[item.from][1] - points[item.to][1]) };
        }), metersPerUnit: null, calibrationStatus: 'unknown',
      navigableAreas: [], walls: [], status: 'candidate' } as unknown as NavigationGraph;
    const result = mergeGraphNodes(graph, { b: 'a', c: 'a' });
    expect(result.graph.nodes.map(item => item.id)).toEqual(['a', 'west', 'east']);
    expect(result.graph.edges.map(item => item.id)).toEqual(['west-a', 'east-a', 'east-c']);
    expect(result.graph.edges.find(item => item.id === 'east-c')).toMatchObject({ from: 'a', to: 'east', bidirectional: false, accessibility: 'confirmed' });
    expect(result.edgeIds).toMatchObject({ 'west-b': 'west-a', 'west-c': 'west-a', 'east-c': 'east-c' });
    expect(mergeSourceLinks([{ edgeId: 'west-b', sourceSpineIds: [1], sourceReferences: ['src'], tests: 'proof' }], result.edgeIds))
      .toEqual([{ edgeId: 'west-a', sourceSpineIds: [1], sourceReferences: ['src'], tests: 'proof' }]);
    expect(() => mergeGraphNodes(graph, { b: 'a' }, true, new Set(['a']))).toThrow(/cannot be merged/);
    expect(() => mergeGraphNodes(graph, { b: 'a' })).not.toThrow();
    expect(() => mergeGraphNodes({ ...graph, nodes: graph.nodes.map(item => item.id === 'b' ? { ...item, roomId: 'room' } : item) }, { b: 'a' })).toThrow(/cannot be merged/);
    expect(() => mergeGraphNodes({ ...graph, nodes: graph.nodes.map(item => item.id === 'b' ? { ...item, floorId: 'GF' } : item) }, { b: 'a' })).toThrow(/same-floor/);
    expect(() => mergeGraphNodes({ ...graph, nodes: graph.nodes.map(item => item.id === 'b' ? { ...item, status: 'unknown' } : item) }, { b: 'a' })).toThrow(/metadata or evidence/);
    expect(() => mergeGraphNodes({ ...graph, nodes: graph.nodes.map(item => item.id === 'b' ? { ...item, point: [12, 10] as [number, number] } : item) }, { b: 'a' })).toThrow(/on top/);
    expect(() => mergeGraphNodes(graph, { b: 'a', a: 'b' })).toThrow(/cycles/);
  });
  it('moves an entire selection by the same snapped delta, including endpoints', () => {
    const result = translate(spines, new Set(controls(spines).map(c => c.id)), [12, -12], 5);
    expect(result[0].coordinates).toEqual([[10, -10], [20.3, .6999999999999993], [30.8, 5.199999999999999], [40, 20]]);
    expect(result[0].coordinates[2][0] - result[0].coordinates[1][0]).toBeCloseTo(10.5);
    expect(spines[0].coordinates[1]).toEqual([10.3, 10.7]);
  });
  it('leaves unselected points unchanged and rejects non-finite movement', () => {
    expect(translate(spines, new Set(['spine:0/1']), [1, 2])[0].coordinates[2]).toEqual([20.8, 15.2]);
    expect(translate(spines, new Set(['spine:0/1']), [NaN, 2])).toBe(spines);
  });
  it('distinguishes contained from crossing selection', () => {
    const points = controls(spines);
    expect(rectangleSelection(points, [10, 10], [21, 16], 1)).toEqual(['spine:0/1', 'spine:0/2']);
    expect(rectangleSelection(points, [10.3, 10.7], [20.8, 15.2], 1)).toEqual(['spine:0/1', 'spine:0/2']);
    expect(rectangleSelection(points, [20, 16], [10, 10], 1)).toEqual(['spine:0/1', 'spine:0/2']);
    expect(rectangleSelection(points, [10, 10], [20, 16], 1)).toEqual(['spine:0/1']);
    expect(rectangleSelection(points, [21, 16], [10, 10], 1)).toEqual(['spine:0/1', 'spine:0/2']);
  });
  it('moves mixed selections with one snapped delta and preserves graph IDs', () => {
    const graph: NavigationGraph = {
      nodes: [
        { id: 'junction', buildingId: 'B03', floorId: 'GF', point: [0, 0], type: 'junction', status: 'candidate' },
        { id: 'approach', buildingId: 'B03', floorId: 'GF', point: [10, 0], roomId: 'G-1', type: 'door', status: 'candidate' },
      ],
      edges: [{ id: 'edge-id', from: 'junction', to: 'approach', floorId: 'GF', pathType: 'corridor', distance: 10, distanceUnit: 'map-unit', accessibility: 'unknown', restriction: 'unknown', status: 'candidate', bidirectional: true, geometry: [[0, 0], [5, 1], [10, 0]] }],
      metersPerUnit: null, calibrationStatus: 'unknown', navigableAreas: [], walls: [], status: 'candidate',
    };
    const result = translateSelection(spines, graph, {}, new Set(['spine:0/1']), new Set(['junction', 'approach']), [4, 3], 5);
    expect(result.spines[0].coordinates[1]).toEqual([15.3, 15.7]);
    expect(result.nodeMoves).toEqual({ junction: [5, 5], approach: [15, 5] });
    expect(translateSelection(spines, graph, {}, new Set(), new Set(['junction']), [0, 0]).nodeMoves).toEqual({});
    expect(translateSelection(spines, graph, {}, new Set(['spine:0/1']), new Set(['junction']), [Infinity, 1])).toEqual({ spines, nodeMoves: {} });
    const moved = moveGraphNodes(graph, result.nodeMoves);
    expect(moved.nodes.map(n => [n.id, n.point])).toEqual([['junction', [5, 5]], ['approach', [15, 5]]]);
    expect(moved.edges[0].geometry).toEqual([[5, 5], [5, 1], [15, 5]]);
  });
  it('supports polygon lasso and numeric group statistics', () => {
    expect(inside([2, 2], [[0, 0], [5, 0], [5, 5], [0, 5]])).toBe(true);
    expect(inside([8, 2], [[0, 0], [5, 0], [5, 5], [0, 5]])).toBe(false);
    expect(selectionStats(controls(spines).slice(1, 3))?.average[0]).toBeCloseTo(15.55);
  });
  it('still retains endpoints when deleting a full selection', () => {
    expect(deleteControls(spines, new Set(controls(spines).map(c => c.id)))[0].coordinates).toEqual([[0, 0], [30, 30]]);
  });
  it('moves graph nodes together with connected edge endpoints for preview', () => {
    const graph: NavigationGraph = {
      nodes: [
        { id: 'a', buildingId: 'B03', floorId: 'GF', point: [0, 0], type: 'junction', status: 'candidate' },
        { id: 'b', buildingId: 'B03', floorId: 'GF', point: [10, 0], type: 'junction', status: 'candidate' },
      ],
      edges: [{ id: 'ab', from: 'a', to: 'b', floorId: 'GF', pathType: 'corridor', distance: 10, distanceUnit: 'map-unit', accessibility: 'unknown', restriction: 'unknown', status: 'candidate', bidirectional: true, geometry: [[0, 0], [5, 2], [10, 0]] }],
      metersPerUnit: null, calibrationStatus: 'unknown', navigableAreas: [], walls: [], status: 'candidate',
    };
    const moved = moveGraphNodes(graph, { a: [2, 3], b: [12, 3] });
    expect(moved.nodes.map(node => node.point)).toEqual([[2, 3], [12, 3]]);
    expect(moved.edges[0].geometry).toEqual([[2, 3], [5, 2], [12, 3]]);
    expect(moved.edges[0].distance).toBeCloseTo(Math.hypot(3, -1) + Math.hypot(7, 1));
    expect(graph.nodes[0].point).toEqual([0, 0]);
  });
  it('propagates edited source spines to linked junctions while preserving room approaches', () => {
    const graph: NavigationGraph = {
      nodes: [
        { id: 'j', buildingId: 'B03', floorId: 'GF', point: [5, 0], type: 'junction', status: 'candidate' },
        { id: 'room', buildingId: 'B03', floorId: 'GF', point: [10, 0], roomId: 'G-1', type: 'door', status: 'candidate' },
      ],
      edges: [{ id: 'e', from: 'j', to: 'room', floorId: 'GF', pathType: 'corridor', distance: 5, distanceUnit: 'map-unit', accessibility: 'unknown', restriction: 'unknown', status: 'candidate', bidirectional: true, geometry: [[5, 0], [10, 0]] }],
      metersPerUnit: null, calibrationStatus: 'unknown', navigableAreas: [], walls: [], status: 'candidate',
    };
    const original: Spine[] = [{ ...spines[0], coordinates: [[0, 0], [10, 0]] }];
    const edited: Spine[] = [{ ...spines[0], coordinates: [[0, 10], [10, 10]] }];
    const moved = propagateSourceLinks(graph, original, edited, [{ edgeId: 'e', sourceSpineIds: [0], sourceReferences: [], tests: {} }]);
    expect(moved.nodes.find(node => node.id === 'j')?.point).toEqual([5, 10]);
    expect(moved.nodes.find(node => node.id === 'room')?.point).toEqual([10, 0]);
    expect(moved.edges[0].geometry[0]).toEqual([5, 10]);
    // Explicit mixed selection must override the linked junction's inferred move,
    // rather than applying the source delta a second time.
    const mixed = translateSelection(original, graph, {}, new Set(controls(original).map(c => c.id)), new Set(['j', 'room']), [0, 10]);
    const linked = propagateSourceLinks(graph, original, mixed.spines, [{ edgeId: 'e', sourceSpineIds: [0], sourceReferences: [], tests: {} }]);
    const mixedGraph = moveGraphNodes(linked, mixed.nodeMoves);
    expect(mixedGraph.nodes.map(n => n.point)).toEqual([[5, 10], [10, 10]]);
    expect(graphEditPayload(mixed.nodeMoves, { j: [5, 10] })).toEqual({
      nodeMoves: { j: [5, 10], room: [10, 10] }, explicitNodeMoves: mixed.nodeMoves,
    });
    const again = translateSelection(mixed.spines, mixedGraph, mixed.nodeMoves, new Set(['spine:0/0']), new Set(['j']), [2, -3]);
    expect(again.nodeMoves.j).toEqual([7, 7]);
    expect(again.nodeMoves.room).toEqual([10, 10]);
    expect(again.spines[0].coordinates).toEqual([[2, 7], [10, 10]]);
    const offset = { ...graph, nodes: graph.nodes.map(n => n.id === 'j' ? { ...n, point: [5, 2] as [number, number] } : n) };
    const linkedEvidence = [{ edgeId: 'e', sourceSpineIds: [0], sourceReferences: [], tests: null, preserveOffset: true }];
    const first = propagateSourceLinks(offset, original, edited, linkedEvidence);
    expect(first.nodes[0].point).toEqual([5, 12]);
    const secondSource: Spine[] = [{ ...edited[0], coordinates: [[0, 20], [10, 20]] }];
    expect(propagateSourceLinks(first, edited, secondSource, linkedEvidence).nodes[0].point).toEqual([5, 22]);
  });
  it('requires configured admin credentials and accepts five-character passwords such as admin', () => {
    const previous = [process.env.WAYFINDING_ADMIN_USER, process.env.WAYFINDING_ADMIN_PASSWORD];
    try {
      process.env.WAYFINDING_ADMIN_USER = 'test-admin'; process.env.WAYFINDING_ADMIN_PASSWORD = 'local-test-password-123';
      expect(adminAuthorized(new Headers())).toBe(false);
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:wrong').toString('base64') }))).toBe(false);
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:local-test-password-123').toString('base64') }))).toBe(true);
      process.env.WAYFINDING_ADMIN_PASSWORD = 'abcde';
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:abcde').toString('base64') }))).toBe(true);
      process.env.WAYFINDING_ADMIN_USER = 'admin'; process.env.WAYFINDING_ADMIN_PASSWORD = 'admin';
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') }))).toBe(true);
      process.env.WAYFINDING_ADMIN_PASSWORD = 'abcd';
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:abcd').toString('base64') }))).toBe(false);
      delete process.env.WAYFINDING_ADMIN_PASSWORD;
      expect(adminAuthorized(new Headers())).toBe(false);
    } finally {
      if (previous[0] === undefined) delete process.env.WAYFINDING_ADMIN_USER; else process.env.WAYFINDING_ADMIN_USER = previous[0];
      if (previous[1] === undefined) delete process.env.WAYFINDING_ADMIN_PASSWORD; else process.env.WAYFINDING_ADMIN_PASSWORD = previous[1];
    }
  });
});
