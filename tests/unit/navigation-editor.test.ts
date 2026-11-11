import { describe, expect, it } from 'vitest';
import { coincidenceClusters, controls, deleteControls, inside, moveGraphNodes, nextCoincidenceMember, propagateSourceLinks, rectangleSelection, selectionStats, translate, type Spine } from '../../apps/web/components/admin/editor-model';
import { adminAuthorized } from '../../apps/web/lib/admin-auth';
import type { NavigationGraph } from '@wayfinding/map-engine';

const spines: Spine[] = [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[0, 0], [10.3, 10.7], [20.8, 15.2], [30, 30]], sourceReferences: ['source'] }];
describe('navigation source editor', () => {
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
    expect(rectangleSelection(points, [10, 10], [21, 16], 1)).toEqual([]);
    expect(rectangleSelection(points, [21, 16], [10, 10], 1)).toEqual(['spine:0/1', 'spine:0/2']);
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
