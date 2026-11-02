import { describe, expect, it } from 'vitest';
import { controls, deleteControls, inside, moveGraphNodes, rectangleSelection, selectionStats, translate, type Spine } from '../../apps/web/components/admin/editor-model';
import { adminAuthorized } from '../../apps/web/lib/admin-auth';
import type { NavigationGraph } from '@wayfinding/map-engine';

const spines: Spine[] = [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[0, 0], [10.3, 10.7], [20.8, 15.2], [30, 30]], sourceReferences: ['source'] }];
describe('navigation source editor', () => {
  it('moves an entire selection by the same snapped delta and preserves endpoints', () => {
    const result = translate(spines, new Set(controls(spines).map(c => c.id)), [12, -12], 5);
    expect(result[0].coordinates).toEqual([[0, 0], [20.3, .6999999999999993], [30.8, 5.199999999999999], [30, 30]]);
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
  it('never deletes protected endpoints', () => {
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
  it('requires configured admin credentials and accepts passwords of at least five characters', () => {
    const previous = [process.env.WAYFINDING_ADMIN_USER, process.env.WAYFINDING_ADMIN_PASSWORD];
    try {
      process.env.WAYFINDING_ADMIN_USER = 'test-admin'; process.env.WAYFINDING_ADMIN_PASSWORD = 'local-test-password-123';
      expect(adminAuthorized(new Headers())).toBe(false);
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:wrong').toString('base64') }))).toBe(false);
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:local-test-password-123').toString('base64') }))).toBe(true);
      process.env.WAYFINDING_ADMIN_PASSWORD = 'abcde';
      expect(adminAuthorized(new Headers({ authorization: 'Basic ' + Buffer.from('test-admin:abcde').toString('base64') }))).toBe(true);
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
