import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateFloorBundle, type FloorData, type NavigationGraph, type RoomContent } from '@wayfinding/map-engine';
import { findRoute } from '@wayfinding/routing';
import { navigationStorePath, publishedNavigation } from '../../apps/web/lib/navigation-store';

type AuthoredFixture = {
  floorId: 'GF' | '01'; canonicalFloor: FloorData; canonicalGraph: NavigationGraph; contents: RoomContent[];
  snapshot: { schemaVersion: 1; buildingId: string; floorId: string; revision: string;
    config: unknown; graph: NavigationGraph; floorData: FloorData };
};
const fixtures = JSON.parse(execFileSync(process.env.PYTHON_EXECUTABLE || 'python',
  ['tests/qa/export_admin_authoring_fixture.py'], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 })) as AuthoredFixture[];
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory=>rm(directory, { recursive: true, force: true })));
});

describe('real worker-authored publication contract', () => {
  for (const fixture of fixtures) {
    it(`${fixture.floorId}: loads serialized masks, reviewed endpoints and candidate routing without access upgrade`, async () => {
      const directory=await mkdtemp(path.join(os.tmpdir(), 'authored-loader-'));
      directories.push(directory);
      vi.stubEnv('WAYFINDING_NAVIGATION_STORE',path.join(directory,'navigation.json'));
      await writeFile(navigationStorePath(fixture.floorId),JSON.stringify(fixture.snapshot));
      const result=await publishedNavigation(fixture.floorId,fixture.canonicalFloor,fixture.canonicalGraph,fixture.contents);
      const endpoint=`B03-${fixture.floorId}-admin-node-entry`;
      expect(result.floorData.rooms[0].doorNodeId).toBe(endpoint);
      expect(result.floorData.rooms[0].navigationNote?.en).toContain('unverified');
      expect(result.floorData.rooms[0].navigationNote?.ar).toBeTruthy();
      expect(result.floorData.rooms[0].navigationPartial).toBe(true);
      expect(result.floorData.rooms[0].provenance).toEqual(fixture.canonicalFloor.rooms[0].provenance);
      expect(result.floorData.rooms[0].adminEndpointHistory?.[0].doorNodeId).toBeNull();
      expect(result.graph.adminAuthoring?.originalNavigableAreas).toEqual(fixture.canonicalGraph.navigableAreas);
      expect(result.graph.adminAuthoring?.navigableAreaEdits[0].review.status).toBe('candidate');
      expect(findRoute(result.graph,'west',endpoint).status).toBe('ok');
      expect(findRoute(result.graph,'west',endpoint,{ accessibleOnly: true }).status).not.toBe('ok');
      const geometryGuard=structuredClone(result.graph);
      geometryGuard.nodes.push({ id:'hole-start',buildingId:'B03',floorId:fixture.floorId,point:[1155,965],type:'junction',status:'candidate' },
        { id:'hole-end',buildingId:'B03',floorId:fixture.floorId,point:[1175,965],type:'junction',status:'candidate' });
      geometryGuard.edges.push({ id:'cross-hole',from:'hole-start',to:'hole-end',floorId:fixture.floorId,pathType:'corridor',
        distance:20,distanceUnit:'map-unit',geometry:[[1155,965],[1175,965]],status:'candidate',
        accessibility:'unknown',restriction:'unknown',bidirectional:true });
      expect(()=>validateFloorBundle(result.floorData,geometryGuard,fixture.contents)).toThrow(/outside navigable/);
      expect(findRoute(geometryGuard,'hole-start','hole-end').status).not.toBe('ok');
    });

    it(`${fixture.floorId}: rejects malformed admin evidence even on deliberately unsafe-geometry loading`, () => {
      const graph=structuredClone(fixture.snapshot.graph);
      graph.adminAuthoring!.navigableAreaEdits[0].review.status='confirmed' as 'candidate';
      expect(()=>validateFloorBundle(fixture.snapshot.floorData,graph,fixture.contents,{allowUnsafeGeometry:true}))
        .toThrow(/must remain candidate/);
      const nodeGraph=structuredClone(fixture.snapshot.graph);
      nodeGraph.nodes.find(node=>node.adminReview)!.status='confirmed';
      expect(()=>validateFloorBundle(fixture.snapshot.floorData,nodeGraph,fixture.contents,{allowUnsafeGeometry:true}))
        .toThrow(/must remain candidate/);
    });

    it(`${fixture.floorId}: fails closed when published floor identity is mismatched`, async () => {
      const directory=await mkdtemp(path.join(os.tmpdir(),'authored-wrong-floor-'));
      directories.push(directory);
      vi.stubEnv('WAYFINDING_NAVIGATION_STORE',path.join(directory,'navigation.json'));
      const snapshot=structuredClone(fixture.snapshot);
      snapshot.floorData.floor.id=fixture.floorId==='GF'?'01':'GF';
      await writeFile(navigationStorePath(fixture.floorId),JSON.stringify(snapshot));
      await expect(publishedNavigation(fixture.floorId,fixture.canonicalFloor,fixture.canonicalGraph,fixture.contents))
        .rejects.toThrow(/Invalid published floor data/);
    });
  }
});
