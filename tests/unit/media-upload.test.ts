import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_MEDIA_BYTES, readStoredMedia, storeMedia, validateMediaUpload } from '../../apps/web/lib/media-upload';

let directory = '';
afterEach(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); directory = ''; });

describe('CMS media storage', () => {
  it('rejects unsupported MIME, mismatched extension, unsafe names, and oversized media', () => {
    for (const input of [
      { name: 'a.svg', type: 'image/svg+xml', size: 1 },
      { name: 'a.png', type: 'image/jpeg', size: 1 },
      { name: '../a.jpg', type: 'image/jpeg', size: 1 },
      { name: 'a.jpg', type: 'image/jpeg', size: MAX_MEDIA_BYTES + 1 },
    ]) expect(() => validateMediaUpload(input)).toThrow();
  });

  it('writes only signature-matching bytes under an opaque name and serves them back', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'wayfinding-media-'));
    vi.stubEnv('WAYFINDING_MEDIA_STORE', directory);
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])], 'floor.png', { type: 'image/png' });
    const result = await storeMedia(file);
    expect(result.url).toMatch(/^\/api\/media\/[a-f0-9]{64}\.png$/);
    const name = result.url.split('/').at(-1)!;
    expect((await readStoredMedia(name))?.type).toBe('image/png');
    expect((await readFile(path.join(directory, name))).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await expect(storeMedia(new File(['not png'], 'fake.png', { type: 'image/png' }))).rejects.toThrow(/contents/);
    expect(await readStoredMedia('../secret.png')).toBeNull();
  });
});
