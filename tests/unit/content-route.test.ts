import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from '../../apps/web/app/api/admin/content/route';
import { contentRevision, publishedContent, readContentState } from '../../apps/web/lib/content-store';

let directory = '';
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = '';
});

function request(body: unknown) {
  return new Request('http://localhost:3666/api/admin/content', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from('test-admin:test-password').toString('base64')}`,
      origin: 'http://localhost:3666', host: 'localhost:3666',
      'content-type': 'application/json', 'x-cms-editor': '1',
    },
    body: JSON.stringify(body),
  });
}
function withFloor(body: Record<string, unknown>, floorId = 'GF') {
  return { ...body, floorId };
}

async function setup() {
  directory = await mkdtemp(path.join(os.tmpdir(), 'wayfinding-content-api-'));
  vi.stubEnv('WAYFINDING_CONTENT_STORE', path.join(directory, 'store.json'));
  vi.stubEnv('WAYFINDING_ADMIN_USER', 'test-admin');
  vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', 'test-password');
  return readContentState();
}

describe('content category API snapshots', () => {
  it.each([{ en: 'Welcome', ar: '' }, { en: '', ar: '\u0645\u0631\u062d\u0628\u0627' }, { en: ' '.repeat(160), ar: '' }])('validates and saves per-locale sticker labels: %j', async stickerLabel => {
    const state = await setup();
    const contents = structuredClone(state.draft);
    contents[0].presentation = { stickerLabel };
    const response = await POST(request(withFloor({ action: 'save', contents, revision: contentRevision(state) })));
    expect(response.status).toBe(200);
    expect((await readContentState()).draft[0].presentation?.stickerLabel).toEqual(stickerLabel);
    expect(await publishedContent()).toEqual(state.published);
  });

  it('saves and publishes assignments and groups atomically, rejecting stale and dangling snapshots', async () => {
    const state = await setup();
    const contents = structuredClone(state.draft);
    contents[0].presentation = { colorGroupId: 'visitors' };
    const colorGroups = [{ id: 'visitors', name: 'Visitors', color: '#123456' }];
    const revision = contentRevision(state);
    const save = await POST(request(withFloor({ action: 'save', contents, colorGroups, revision })));
    expect(save.status).toBe(200);
    const saved = await save.json();
    expect((await readContentState()).draftColorGroups).toEqual(colorGroups);
    expect(await publishedContent()).toEqual(state.published);
    expect((await POST(request(withFloor({ action: 'publish', contents, colorGroups, revision })))).status).toBe(409);
    const invalid = await POST(request(withFloor({ action: 'publish', contents, colorGroups: [], revision: saved.revision })));
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error).toContain('Unassign');
    expect(contentRevision(await readContentState())).toBe(saved.revision);
    const publish = await POST(request(withFloor({ action: 'publish', contents, colorGroups, revision: saved.revision })));
    expect(publish.status).toBe(200);
    expect((await publishedContent())[0].presentation?.blockColor).toBe('#123456');
    expect((await readContentState()).publishedColorGroups).toEqual(colorGroups);
  }, 20000);

  it('keeps the 300 KB request bound and rejects invalid category definitions without writes', async () => {
    const state = await setup();
    expect((await POST(request({ padding: 'x'.repeat(300001) }))).status).toBe(413);
    const response = await POST(request({
      ...withFloor({ action: 'save', contents: state.draft, revision: contentRevision(state) }),
      colorGroups: [{ id: 'bad', name: 'Invalid', color: '#abc' }],
    }));
    expect(response.status).toBe(422);
    expect(contentRevision(await readContentState())).toBe(contentRevision(state));
  });

  it('requires an allowed floor ID and validates content against that floor', async () => {
    const state = await setup();
    const headers = { authorization: `Basic ${Buffer.from('test-admin:test-password').toString('base64')}` };
    expect((await GET(new Request('http://localhost:3666/api/admin/content', { headers }))).status).toBe(400);
    expect((await GET(new Request('http://localhost:3666/api/admin/content?floorId=02', { headers }))).status).toBe(400);
    const firstFloorResponse = await GET(new Request('http://localhost:3666/api/admin/content?floorId=01', { headers }));
    expect(firstFloorResponse.status).toBe(200);
    expect((await firstFloorResponse.json()).floorId).toBe('01');
    expect((await POST(request({ action: 'save', contents: state.draft, revision: contentRevision(state) }))).status).toBe(400);
    expect((await POST(request(withFloor({ action: 'save', contents: state.draft, revision: contentRevision(state) }, '02')))).status).toBe(400);
    const wrongFloor = await POST(request(withFloor({ action: 'save', contents: state.draft, revision: contentRevision(state) }, '01')));
    expect(wrongFloor.status).toBe(422);
  });
});
