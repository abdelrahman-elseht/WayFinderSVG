import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { POST } from '../../apps/web/app/api/admin/content/upload/route';

let directory = '';
afterEach(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); directory = ''; });

function request(file?: File, origin = 'http://localhost:3000') {
  const body = new FormData(); if (file) body.set('file', file);
  return new Request('http://localhost:3000/api/admin/content/upload', {
    method: 'POST', headers: { authorization: `Basic ${Buffer.from('admin:strong-pass').toString('base64')}`, origin, host: 'localhost:3000', 'x-cms-editor': '1' }, body,
  });
}

describe('CMS upload endpoint', () => {
  it('requires configured admin credentials and a same-origin editor request', async () => {
    vi.stubEnv('WAYFINDING_ADMIN_USER', 'admin'); vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', 'strong-pass');
    expect((await POST(request(undefined, 'https://attacker.example'))).status).toBe(403);
    vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', '');
    expect((await POST(request())).status).toBe(401);
  });

  it('accepts a signature-checked same-origin upload and returns only its served URL', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'wayfinding-upload-route-'));
    vi.stubEnv('WAYFINDING_MEDIA_STORE', directory); vi.stubEnv('WAYFINDING_ADMIN_USER', 'admin'); vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', 'strong-pass');
    const response = await POST(request(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'room.png', { type: 'image/png' })));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ type: 'image/png', url: expect.stringMatching(/^\/api\/media\/[a-f0-9]{64}\.png$/) });
  });
});
