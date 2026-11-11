import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { ColorGroup, RoomContent } from '@wayfinding/map-engine';
import { presentationColor, validateColorGroups, validateFloorBundle } from '@wayfinding/map-engine';
import floor from '@data/buildings/B03/GF.json';
import graph from '@data/buildings/B03/GF.graph.json';
import firstFloor from '@data/buildings/B03/01.json';
import firstGraph from '@data/buildings/B03/01.graph.json';

export type CmsFloorId = 'GF' | '01';
export type ContentStoreState = {
  floorId?: CmsFloorId;
  draft: RoomContent[];
  published: RoomContent[];
  draftColorGroups?: ColorGroup[];
  publishedColorGroups?: ColorGroup[];
};

export class StaleContentRevisionError extends Error {
  constructor() { super('Content changed since it was loaded. Reload before saving.'); }
}

const bundles = {
  GF: { floor, graph, canonical: () => import('@content/B03/GF.json') },
  '01': { floor: firstFloor, graph: firstGraph, canonical: () => import('@content/B03/01.json') },
} as const;

export function isCmsFloorId(value: unknown): value is CmsFloorId {
  return value === 'GF' || value === '01';
}

function storePath(floorId: CmsFloorId = 'GF') {
  if (process.env.WAYFINDING_CONTENT_STORE) {
    const configured = path.resolve(process.env.WAYFINDING_CONTENT_STORE);
    return floorId === 'GF' ? configured : `${configured}.01`;
  }
  return path.join(process.cwd(), '.data', 'content-overrides', `B03-${floorId}.json`);
}

async function canonical(floorId: CmsFloorId): Promise<RoomContent[]> {
  return (await bundles[floorId].canonical()).default as RoomContent[];
}

function assertContent(value: unknown, floorId: CmsFloorId): RoomContent[] {
  validateFloorBundle(bundles[floorId].floor, bundles[floorId].graph, value, { allowUnsafeGeometry: true });
  return value as RoomContent[];
}

export function contentRevision(state: ContentStoreState, floorId: CmsFloorId = state.floorId ?? 'GF'): string {
  return createHash('sha256').update(JSON.stringify({
    floorId,
    draft: state.draft, published: state.published,
    draftColorGroups: state.draftColorGroups ?? [],
    publishedColorGroups: state.publishedColorGroups ?? [],
  })).digest('hex');
}

function normalizeState(value: ContentStoreState, floorId: CmsFloorId): Required<ContentStoreState> {
  if (value.floorId !== undefined && value.floorId !== floorId) throw new Error('Content store floor does not match requested floor');
  if (!value || !Array.isArray(value.draft) || !Array.isArray(value.published)) throw new Error('Content store must contain draft and published arrays');
  const draft = assertContent(value.draft, floorId);
  const published = assertContent(value.published, floorId);
  return {
    floorId,
    draft, published,
    draftColorGroups: validateColorGroups(value.draftColorGroups === undefined ? [] : value.draftColorGroups, draft),
    publishedColorGroups: validateColorGroups(value.publishedColorGroups === undefined ? [] : value.publishedColorGroups, published),
  };
}

export async function readContentState(floorId: CmsFloorId = 'GF'): Promise<Required<ContentStoreState>> {
  const base = assertContent(await canonical(floorId), floorId);
  try {
    const value = JSON.parse(await readFile(storePath(floorId), 'utf8')) as Partial<ContentStoreState>;
    if (!value || !Array.isArray(value.draft) || !Array.isArray(value.published)) {
      throw new Error('Content store must contain draft and published arrays');
    }
    return normalizeState(value as ContentStoreState, floorId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return normalizeState({ floorId, draft: base, published: base }, floorId);
    throw error;
  }
}

async function acquireLock(lockPath: string): Promise<() => Promise<void>> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const handle = await open(lockPath, 'wx');
      return async () => { await handle.close(); await rm(lockPath, { force: true }); };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  throw new Error('Timed out waiting for content store lock');
}

export async function writeContentState(
  state: ContentStoreState,
  expectedRevision: string,
  floorId: CmsFloorId = state.floorId ?? 'GF',
): Promise<string> {
  if (state.floorId !== floorId) throw new Error('Submission floor does not match store floor');
  const next = normalizeState(state, floorId);
  const target = storePath(floorId);
  await mkdir(path.dirname(target), { recursive: true });
  const release = await acquireLock(`${target}.lock`);
  try {
    let current: ContentStoreState;
    try {
      const parsed = JSON.parse(await readFile(target, 'utf8')) as Partial<ContentStoreState>;
      if (!Array.isArray(parsed.draft) || !Array.isArray(parsed.published)) throw new Error('Malformed content store');
      current = normalizeState(parsed as ContentStoreState, floorId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const base = assertContent(await canonical(floorId), floorId);
      current = { floorId, draft: base, published: base };
    }
    if (current.floorId !== floorId || contentRevision(current, floorId) !== expectedRevision) throw new StaleContentRevisionError();
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx');
      try {
        await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
    return contentRevision(next, floorId);
  } finally {
    await release();
  }
}

export async function publishedContent(floorId: CmsFloorId = 'GF'): Promise<RoomContent[]> {
  const state = await readContentState(floorId);
  // Resolve only the published snapshot, so callers cannot expose draft colors.
  return state.published.map(item => {
    const color = presentationColor(item, state.publishedColorGroups);
    return color ? { ...item, presentation: { ...item.presentation, blockColor: color } } : item;
  });
}
