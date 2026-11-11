import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import floor from '../../data/buildings/B03/GF.json';
import graph from '../../data/buildings/B03/GF.graph.json';
import canonicalData from '../../content/B03/GF.json';
import { validateColorGroups, validateFloorBundle, type RoomContent } from '@wayfinding/map-engine';
import { contentRevision, publishedContent, readContentState, StaleContentRevisionError, writeContentState } from '../../apps/web/lib/content-store';
const canonical = canonicalData as RoomContent[];

let directory = '';
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = '';
});

async function useStore() {
  directory = await mkdtemp(path.join(os.tmpdir(), 'wayfinding-cms-'));
  vi.stubEnv('WAYFINDING_CONTENT_STORE', path.join(directory, 'overrides.json'));
  return readContentState();
}

describe('CMS content store', () => {
  it('rejects unsafe image references through the floor bundle validator', () => {
    for (const image of ['//evil.example/a.png', '/media/../secret.png', '/media/%2e%2e/secret.png', '/media\\secret.png', 'javascript:alert(1)', 'data:image/png;base64,AA==']) {
      const contents = structuredClone(canonical);
      contents[0].image = image;
      expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true }), image).toThrow();
    }
    for (const image of ['/media/rooms/a.png', 'https://example.org/a.png']) {
      const contents = structuredClone(canonical);
      contents[0].image = image;
      expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true }), image).not.toThrow();
    }
  });

  it('accepts only presentation-only map overrides on RoomContent', () => {
    const contents = structuredClone(canonical);
    contents[0].presentation = { blockColor: '#12aBcD', stickerLabel: { en: 'Welcome', ar: 'مرحبًا' } };
    expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true })).not.toThrow();
    contents[0].presentation!.blockColor = 'red;url(javascript:alert(1))';
    expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true })).toThrow(/blockColor/);
    contents[0].presentation!.blockColor = '#12abcd';
    contents[0].presentation!.stickerLabel!.ar = '';
    expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true })).not.toThrow();
  });

  it.each([null, [], 'label', { en: 123, ar: '' }, { en: '', ar: null }, { en: '' }, { en: 'x'.repeat(161), ar: '' }])('rejects malformed or oversized sticker labels: %j', stickerLabel => {
    const contents = structuredClone(canonical);
    contents[0].presentation = { stickerLabel } as RoomContent['presentation'];
    expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true })).toThrow(/stickerLabel/);
  });

  it('keeps semantic names and descriptions bilingual and nonblank', () => {
    for (const language of ['en', 'ar'] as const) {
      const contents = structuredClone(canonical);
      contents[0].description[language] = '';
      expect(() => validateFloorBundle(floor, graph, contents, { allowUnsafeGeometry: true })).toThrow(/description/);
      const rooms = structuredClone(floor);
      rooms.rooms[0].name[language] = '';
      expect(() => validateFloorBundle(rooms, graph, canonical, { allowUnsafeGeometry: true })).toThrow(/name/);
    }
  });

  it('fails closed when persisted draft or published content is malformed', async () => {
    const state = await useStore();
    const malformed = { draft: [{ id: 'not-a-room' }], published: canonical };
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(path.join(directory, 'overrides.json'), JSON.stringify(malformed)));
    await expect(readContentState()).rejects.toThrow();
  });

  it('serializes writers, uses unique temporary files, and rejects stale revisions', async () => {
    const state = await useStore();
    const revision = contentRevision(state);
    const edited = structuredClone(state.draft);
    edited[0].description.en += ' edited';
    const results = await Promise.allSettled([
      writeContentState({ ...state, draft: edited }, revision),
      writeContentState({ ...state, draft: edited }, revision),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(StaleContentRevisionError);
    expect(JSON.parse(await readFile(path.join(directory, 'overrides.json'), 'utf8')).draft[0].description.en).toBe(edited[0].description.en);
  });

  it('normalizes legacy stores to empty groups and hashes the normalized snapshot', async () => {
    const state = await useStore();
    const legacy = { draft: state.draft, published: state.published };
    await import('node:fs/promises').then(({ writeFile }) => writeFile(path.join(directory, 'overrides.json'), JSON.stringify(legacy)));
    const normalized = await readContentState();
    expect(normalized.draftColorGroups).toEqual([]);
    expect(normalized.publishedColorGroups).toEqual([]);
    expect(contentRevision(legacy)).toBe(contentRevision(normalized));
  });

  it('isolates GF and 01 drafts, published content, color groups and revisions', async () => {
    const ground = await useStore();
    const first = await readContentState('01');
    expect(first.floorId).toBe('01');
    expect(first.draft.map(item => item.id)).not.toEqual(ground.draft.map(item => item.id));
    const edited = structuredClone(first.draft);
    edited[0].description.en += ' first-floor edit';
    const groups = [{ id: 'first-only', name: 'First floor group', color: '#123456' }];
    const firstRevision = await writeContentState({ ...first, draft: edited, draftColorGroups: groups }, contentRevision(first), '01');
    expect((await readContentState('01')).draftColorGroups).toEqual(groups);
    expect((await readContentState('GF')).draftColorGroups).toEqual([]);
    expect(contentRevision(await readContentState('GF'))).toBe(contentRevision(ground));
    await expect(writeContentState({ ...first, draft: edited }, firstRevision, 'GF')).rejects.toThrow(/floor/i);
  });

  it('isolates draft category colors until groups and assignments are published together', async () => {
    const state = await useStore();
    const edited = structuredClone(state.draft);
    edited[0].presentation = { blockColor: '#112233', colorGroupId: 'visitors' };
    edited[1].presentation = { colorGroupId: 'visitors' };
    const draftGroups = [{ id: 'visitors', name: 'Visitor spaces', color: '#abcdef' }];
    const savedRevision = await writeContentState({ ...state, draft: edited, draftColorGroups: draftGroups }, contentRevision(state));
    expect(await publishedContent()).toEqual(state.published);
    const saved = await readContentState();
    const publishedRevision = await writeContentState({ ...saved, published: saved.draft, publishedColorGroups: saved.draftColorGroups }, savedRevision);
    expect((await publishedContent()).slice(0, 2).map(item => item.presentation?.blockColor)).toEqual(['#abcdef', '#abcdef']);
    const published = await readContentState();
    const recolored = [{ ...draftGroups[0], name: 'Renamed spaces', color: '#654321' }];
    await writeContentState({ ...published, draftColorGroups: recolored }, publishedRevision);
    expect((await publishedContent())[0].presentation?.blockColor).toBe('#abcdef');
    await expect(writeContentState({ ...published, draftColorGroups: recolored }, publishedRevision)).rejects.toBeInstanceOf(StaleContentRevisionError);
    expect((await readContentState()).publishedColorGroups[0].name).toBe('Visitor spaces');
  });

  it('rejects dangling references per snapshot and allows deletion after explicit unassignment', async () => {
    const state = await useStore();
    const edited = structuredClone(state.draft);
    edited[0].presentation = { colorGroupId: 'assigned' };
    const groups = [{ id: 'assigned', name: 'Assigned', color: '#123456' }];
    const revision = await writeContentState({ ...state, draft: edited, draftColorGroups: groups }, contentRevision(state));
    const saved = await readContentState();
    await expect(writeContentState({ ...saved, draftColorGroups: [] }, revision)).rejects.toThrow(/Unassign/);
    await expect(writeContentState({ ...saved, published: edited }, revision)).rejects.toThrow(/Missing color category/);
    expect(contentRevision(await readContentState())).toBe(revision);
    await writeContentState({ ...saved, draft: state.draft, draftColorGroups: [] }, revision);
    expect((await readContentState()).draftColorGroups).toEqual([]);
  });

  it('rejects malformed group IDs, duplicates, names, colors, arrays and references', () => {
    const valid = { id: 'visitors', name: 'Visitors', color: '#12aBcD' };
    for (const groups of [null, {}, [null], [{ ...valid, id: '../bad' }], [valid, valid], [{ ...valid, name: ' ' }], [{ ...valid, name: 'a'.repeat(81) }], [{ ...valid, color: 'red' }]]) {
      expect(() => validateColorGroups(groups, canonical)).toThrow();
    }
    expect(validateColorGroups([valid], canonical)).toEqual([valid]);
    expect(validateColorGroups(Array.from({ length: 20 }, (_, index) => ({ ...valid, id: `category-${index}` })), canonical)).toHaveLength(20);
    const edited = structuredClone(canonical);
    edited[0].presentation = { colorGroupId: 'missing' };
    expect(() => validateColorGroups([valid], edited)).toThrow(/Unassign/);
  });

  it('fails closed for malformed persisted groups, including published-only references', async () => {
    const state = await useStore();
    const published = structuredClone(state.published);
    published[0].presentation = { colorGroupId: 'missing' };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(directory, 'overrides.json'), JSON.stringify({ ...state, published }));
    await expect(publishedContent()).rejects.toThrow(/Missing color category/);
    await writeFile(path.join(directory, 'overrides.json'), JSON.stringify({ ...state, draftColorGroups: null }));
    await expect(readContentState()).rejects.toThrow(/array/);
  });
});
