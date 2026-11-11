import { afterEach, describe, expect, it, vi } from 'vitest';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));

import { POST } from '../../apps/web/app/api/admin/navigation/route';

afterEach(() => {
  vi.unstubAllEnvs();
  spawn.mockReset();
});

function post(body: BodyInit) {
  return new Request('http://localhost:3666/api/admin/navigation', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from('test-admin:test-password').toString('base64')}`,
      origin: 'http://localhost:3666',
      host: 'localhost:3666',
      'content-type': 'application/json',
      'x-navigation-editor': '1',
    },
    body,
  });
}

describe('navigation editor API request validation', () => {
  it('rejects inherited floor allowlist names without starting the worker', async () => {
    vi.stubEnv('WAYFINDING_ADMIN_USER', 'test-admin');
    vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', 'test-password');

    const response = await POST(post('{"floorId":"toString","action":"draft"}'));

    expect(response.status).toBe(400);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects malformed UTF-8 with 400 without starting the worker', async () => {
    vi.stubEnv('WAYFINDING_ADMIN_USER', 'test-admin');
    vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', 'test-password');

    const response = await POST(post(new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d])));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('valid UTF-8');
    expect(spawn).not.toHaveBeenCalled();
  });
});
