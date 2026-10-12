import { describe, expect, it } from 'vitest';
import { validateFloorBundle } from '@wayfinding/map-engine';
import { BLOCK_HEIGHT, featureBlock, roomBlock } from '../../apps/web/components/mapBlocks';
import ground from '../../data/buildings/B03/GF.json';
import groundGraph from '../../data/buildings/B03/GF.graph.json';
import groundContent from '../../content/B03/GF.json';
import first from '../../data/buildings/B03/01.json';
import firstGraph from '../../data/buildings/B03/01.graph.json';
import firstContent from '../../content/B03/01.json';

describe.each([
  ['GF', ground, groundGraph, groundContent],
  ['01', first, firstGraph, firstContent],
] as const)('%s raised blocks', (floorId, raw, graph, content) => {
  it('raises every enclosed destination, including formerly missing rooms and stairs', () => {
    const { floorData } = validateFloorBundle(raw, graph, content);
    for (const room of floorData.rooms) {
      // Open circulation and the skylight void are not enclosed room blocks.
      if (room.category === 'circulation' && !/^stairs?\b/i.test(room.name.en) || room.code === 'G-26') continue;
      const block = roomBlock(room);
      expect(block, room.code).not.toBeNull();
      expect(block?.height, room.code).toBe(BLOCK_HEIGHT);
      expect(block?.polygon.length, room.code).toBeGreaterThan(2);
    }
    expect(floorData.mapFeatures?.filter(f => f.kind === 'elevator')).toHaveLength(5);
    expect(floorData.mapFeatures?.filter(f => f.kind === 'escalator')).toHaveLength(2);
    for (const feature of floorData.mapFeatures ?? []) {
      expect(featureBlock(feature).height).toBe(BLOCK_HEIGHT);
      expect(feature.connectedFloorIds).toEqual([]);
      expect(feature.accessibility).toBe('unknown');
    }
    if (floorId === 'GF') {
      const cafeteria = floorData.rooms.find(r => r.code === 'G-18')!;
      const entrance = graph.nodes.find(n => n.id === cafeteria.doorNodeId)!;
      for (const code of ['G-19', 'G-20', 'G-21']) {
        const room = floorData.rooms.find(r => r.code === code)!;
        expect(graph.nodes.find(n => n.id === room.doorNodeId)?.point).toEqual(entrance.point);
        expect(room.navigationNote?.en).toContain('Cafeteria entrance');
        expect(room.navigationNote?.ar).toContain('الكافتيريا');
      }
    }
  });

  it('rejects unsupported display geometry without weakening semantic label validation', () => {
    const copy = structuredClone(raw);
    const index = copy.rooms.findIndex(r => r.code === (floorId === '01' ? 'F-11' : 'G-10'));
    const room = copy.rooms[index];
    Object.assign(room, { displayFootprint: { polygon: [[0, 0], [1, 0], [1, 1]], geometryStatus: 'candidate', provenance: [] } });
    expect(() => validateFloorBundle(copy, graph, content)).toThrow(/outside floor viewBox/);
    Object.assign(room, { displayFootprint: { polygon: [[1000, 1000], [1100, 1000], [1100, 1100]], geometryStatus: 'candidate', provenance: [] } });
    expect(() => validateFloorBundle(copy, graph, content)).toThrow(/source evidence required/);
  });
});
