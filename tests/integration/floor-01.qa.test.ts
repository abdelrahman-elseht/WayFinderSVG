import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { validateFloorBundle } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { searchRooms } from '@wayfinding/search';
import floor from '../../data/buildings/B03/01.json';
import graph from '../../data/buildings/B03/01.graph.json';
import contents from '../../content/B03/01.json';
import review from '../../data/buildings/B03/01.review.json';
import schedule from '../../maps/B03/01/source/room-schedule.json';

const bundle = validateFloorBundle(floor, graph, contents);
const rooms = new Map(bundle.floorData.rooms.map(room => [room.code, room]));
const nodes = new Map(bundle.graph.nodes.map(node => [node.id, node]));
const adjacent = new Map(bundle.graph.nodes.map(node => [node.id, new Set<string>()]));
for (const edge of bundle.graph.edges) {
  if (edge.restriction === 'closed') continue;
  adjacent.get(edge.from)!.add(edge.to);
  if (edge.bidirectional) adjacent.get(edge.to)!.add(edge.from);
}
const components = new Map<string, number>();
for (const node of bundle.graph.nodes) {
  if (components.has(node.id)) continue;
  const component = components.size;
  const pending = [node.id];
  while (pending.length) {
    const id = pending.pop()!;
    if (components.has(id)) continue;
    components.set(id, component);
    pending.push(...adjacent.get(id)!);
  }
}

describe('First Floor source-backed phase 2 bundle', () => {
  it('accounts for every schedule row without fabricated positions or translations', () => {
    expect(schedule.rows).toHaveLength(59);
    expect(review.rooms).toHaveLength(59);
    expect(bundle.floorData.rooms).toHaveLength(54);
    expect(review.sourceStatusExceptionCount).toBe(5);
    const missing = review.rooms.filter(row => row.status === 'source-status-exception');
    expect(missing.map(row => row.code)).toEqual(['F-10', 'F-18', 'F-28', 'F-29', 'F-45']);
    for (const row of missing) {
      expect(row.labelPosition).toBeNull();
      expect(row.roomId).toBeNull();
      expect(rooms.has(row.code)).toBe(false);
    }
    for (const room of rooms.values()) {
      expect(room.name.en).toBe(schedule.rows.find(row => row.code === room.code)!.name);
      expect(room.name.ar).not.toBe('');
      expect(room.id).toBe(`B03-01-${room.code}`);
      expect(room.contentRef).toBe(room.id);
      expect(room.floorId).toBe('01');
    }
    expect(searchRooms(bundle.floorData.rooms, 'F-31')[0].id).toBe('B03-01-F-31');
    expect(searchRooms(bundle.floorData.rooms, 'الْمَكْتَبَة')[0].id).toBe('B03-01-F-31');
    expect(bundle.floorData.navigationDefaults).toBeUndefined();
    expect(bundle.floorData.kiosks[0].nodeId).toBeNull();
    expect(bundle.floorData.floor.metersPerUnit).toBeNull();
    expect(rooms.get('F-17')!.doorNodeId).toBeNull();
    expect(review.rooms.find(row => row.code === 'F-17')!.planLabels.length).toBeGreaterThan(1);
  });

  it('classifies all 3,481 ordered schedule pairs through the production router', () => {
    const outcomes = [];
    const totals: Record<string, number> = {};
    let crossSeam = 0;
    for (const start of schedule.rows) for (const end of schedule.rows) {
      const a = rooms.get(start.code), b = rooms.get(end.code);
      const result = findRoute(bundle.graph, a?.doorNodeId ?? null, b?.doorNodeId ?? null);
      let classification: string;
      let expectedReason: string | null = null;
      if (!a || !b) {
        classification = 'source-unmapped';
        expectedReason = 'Schedule identity lacks an in-bounds source plan label.';
      } else if (!a.doorNodeId || !b.doorNodeId) {
        classification = 'unsupported-approach';
        expectedReason = 'Source review withholds at least one endpoint connection.';
      } else if (a.availability?.status === 'unavailable' || b.availability?.status === 'unavailable') {
        classification = 'restricted';
        expectedReason = 'Operational availability prevents a visitor journey.';
      } else if (components.get(a.doorNodeId) !== components.get(b.doorNodeId)) {
        classification = 'disconnected';
        expectedReason = 'Supported source approaches lie in disconnected constrained components.';
      } else {
        const samePoint = JSON.stringify(nodes.get(a.doorNodeId)!.point) === JSON.stringify(nodes.get(b.doorNodeId)!.point);
        classification = a.id === b.id ? 'self' : samePoint ? 'shared-approach' : a.navigationPartial || b.navigationPartial ? 'partial' : 'supported-connected';
      }
      if (expectedReason && classification !== 'restricted') {
        expect(result.status, `${start.code} → ${end.code}: ${classification}`).toBe('unavailable');
        expect(result.reason?.en).toBeTruthy();
        expect(result.reason?.ar).toBeTruthy();
        expect(result.points).toHaveLength(0);
      } else if (!expectedReason) {
        expect(result.status, `${start.code} → ${end.code}`).toBe('ok');
        expect(result.distanceUnit).toBe('map-unit');
        expect(result.points[0]).toEqual(nodes.get(a!.doorNodeId!)!.point);
        expect(result.points.at(-1)).toEqual(nodes.get(b!.doorNodeId!)!.point);
        expect(result.instructions.every(instruction => instruction.text.en && instruction.text.ar)).toBe(true);
        if (result.points.some(p => p[0] < 2055) && result.points.some(p => p[0] > 2055)) crossSeam++;
      }
      totals[classification] = (totals[classification] ?? 0) + 1;
      outcomes.push({ start: start.code, end: end.code, classification, expectedReason,
        status: result.status, reason: result.reason, distance: result.status === 'ok' ? result.distance : null });
    }
    expect(outcomes).toHaveLength(3481);
    expect(Object.values(totals).reduce((sum, count) => sum + count, 0)).toBe(3481);
    expect(totals['supported-connected']).toBeGreaterThan(100);
    expect(crossSeam).toBeGreaterThan(0);
    mkdirSync('artifacts/qa/floor-01', { recursive: true });
    writeFileSync('artifacts/qa/floor-01/route-matrix.json', JSON.stringify({ scheduleCount: 59,
      runtimeRooms: rooms.size, supportedApproaches: [...rooms.values()].filter(room => room.doorNodeId).length,
      orderedPairs: outcomes.length, totals, crossSeamSuccessfulPairs: crossSeam, failures: [], outcomes }, null, 2) + '\n');
  }, 600000);

  it('excludes unknown accessibility and keeps both endpoint qualifications available', () => {
    const a = rooms.get('F-04')!, b = rooms.get('F-31')!;
    expect(findRoute(bundle.graph, a.doorNodeId, b.doorNodeId).status).toBe('ok');
    expect(findRoute(bundle.graph, b.doorNodeId, a.doorNodeId).status).toBe('ok');
    expect(findRoute(bundle.graph, a.doorNodeId, b.doorNodeId, { accessibleOnly: true }).status).toBe('unavailable');
    for (const room of [a, b]) {
      expect(room.navigationNote?.en).toBeTruthy();
      expect(room.navigationNote?.ar).toBeTruthy();
    }
    expect(findRoute(bundle.graph, 'B03-GF-G-01-approach', b.doorNodeId).status).not.toBe('ok');
    expect(bundle.graph.nodes.every(node => node.floorId === '01')).toBe(true);
    expect(bundle.graph.edges.every(edge => edge.floorId === '01' && edge.pathType !== 'stairs' && edge.pathType !== 'elevator')).toBe(true);
  });
});
