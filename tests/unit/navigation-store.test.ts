import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import floor from '@data/buildings/B03/01.json';
import graph from '@data/buildings/B03/01.graph.json';
import contents from '@content/B03/01.json';
import { validateFloorBundle } from '@wayfinding/map-engine';
import { navigationFloorData, navigationStorePath, publishedNavigation } from '../../apps/web/lib/navigation-store';

const temporary: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('runtime navigation publication', () => {
  it('isolates configured stores by floor', () => {
    vi.stubEnv('WAYFINDING_NAVIGATION_STORE', path.join(os.tmpdir(), 'navigation.json'));
    expect(navigationStorePath('01')).toBe(`${path.join(os.tmpdir(), 'navigation.json')}.01`);
    expect(navigationStorePath('GF')).toBe(path.join(os.tmpdir(), 'navigation.json'));
  });

  it('reconciles deleted room endpoints without altering source identity', () => {
    const fixture = validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true });
    const source = fixture.floorData;
    const first = source.rooms.find(room => room.doorNodeId)!;
    const edited = { ...fixture.graph, nodes: fixture.graph.nodes.filter(node => node.id !== first.doorNodeId) };
    const result = navigationFloorData(source, edited);
    expect(result.rooms.find(room => room.id === first.id)?.doorNodeId).toBeNull();
    expect(first.doorNodeId).not.toBeNull();
  });

  it('loads a newly published snapshot on every call', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'navigation-store-'));
    temporary.push(directory);
    vi.stubEnv('WAYFINDING_NAVIGATION_STORE', path.join(directory, 'live.json'));
    const base = { schemaVersion: 1, buildingId: 'B03', floorId: '01' };
    const target = navigationStorePath('01');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ ...base, revision: 'first', graph }));
    expect((await publishedNavigation('01', floor, graph, contents)).graph.edges).toHaveLength(graph.edges.length);
    const next = { ...graph, edges: [] };
    await writeFile(target, JSON.stringify({ ...base, revision: 'second', graph: next }));
    expect((await publishedNavigation('01', floor, graph, contents)).graph.edges).toHaveLength(0);
  });

  it('fails closed on corrupt or cross-floor snapshots instead of silently showing canonical data', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'navigation-store-invalid-'));
    temporary.push(directory);
    vi.stubEnv('WAYFINDING_NAVIGATION_STORE', path.join(directory, 'live.json'));
    await writeFile(navigationStorePath('01'), '{');
    await expect(publishedNavigation('01', floor, graph, contents)).rejects.toThrow();
    await writeFile(navigationStorePath('01'), JSON.stringify({
      schemaVersion: 1, buildingId: 'B03', floorId: 'GF', revision: 'wrong-floor', graph,
    }));
    await expect(publishedNavigation('01', floor, graph, contents)).rejects.toThrow('Invalid navigation publication');
  });
});
