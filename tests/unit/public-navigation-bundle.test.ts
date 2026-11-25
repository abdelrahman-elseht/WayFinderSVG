import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FloorBundle } from '@wayfinding/map-engine';
import floor from '../../data/buildings/B03/GF.json';
import graph from '../../data/buildings/B03/GF.graph.json';
import content from '../../content/B03/GF.json';
import firstFloor from '../../data/buildings/B03/01.json';
import firstGraph from '../../data/buildings/B03/01.graph.json';
import { publicMapBundle, publicNavigationBundle, publicNavigationRevision } from '../../apps/web/lib/public-navigation-bundle';

describe('public navigation bundle', () => {
  const bundle = { floorData: floor, graph, contents: content } as unknown as FloorBundle;

  it('uses content-revisioned source map URLs and excludes authoring-only graph data', () => {
    const published = publicNavigationBundle(bundle);
    const svg = readFileSync(path.join(process.cwd(), 'apps/web/public/maps/B03/GF/master.svg'));
    const sourceRevision = createHash('sha256').update(svg).digest('hex').slice(0, 16);

    expect(published.floorData.floor.mapAsset).toBe(`/maps/B03/GF/master.svg?v=${sourceRevision}`);
    expect(published.graph.adminAuthoring).toBeUndefined();
    expect(publicNavigationRevision(published)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps non-B03 map paths unchanged', () => {
    const bundle = publicNavigationBundle({
      floorData: { ...floor, building: { ...floor.building, id: 'OTHER' } },
      graph,
      contents: content,
    } as unknown as FloorBundle);
    expect(bundle.floorData.floor.mapAsset).toBe('/maps/B03/GF/master.svg');
  });

  it('keeps only transition nodes in the initial map bundle', () => {
    const mapBundle = publicMapBundle(bundle);
    expect(mapBundle.graph.nodes.every(node => node.type === 'elevator' || node.type === 'escalator')).toBe(true);
    expect(mapBundle.graph.edges).toEqual([]);
    expect(mapBundle.graph.walls).toEqual([]);
    expect(mapBundle.graph.navigableAreas).toEqual([]);
    expect(mapBundle.floorData.rooms).toHaveLength(floor.rooms.length);
  });

  it('preserves both First Floor transition markers, including the lift landing', () => {
    const firstFloorBundle = publicMapBundle({ floorData: firstFloor, graph: firstGraph, contents: [] } as unknown as FloorBundle);
    expect(firstFloorBundle.graph.nodes.filter(node => node.type === 'elevator' || node.type === 'escalator').map(node => node.id)).toEqual([
      'B03-01-admin-node-escalator-transition',
      'B03-01-admin-node-lift-transition',
    ]);
    expect(firstFloorBundle.graph.nodes.find(node => node.id === 'B03-01-admin-node-lift-transition')).toMatchObject({
      floorId: '01',
      type: 'elevator',
      transitionId: 'B03-transition-lift-5',
      point: [2487.0308540860856, 1310.4467264612229],
    });
  });
});
