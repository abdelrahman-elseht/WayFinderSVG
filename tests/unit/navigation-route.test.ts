import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));

import { GET, POST } from '../../apps/web/app/api/admin/navigation/route';

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
  function authorize() {
    vi.stubEnv('WAYFINDING_ADMIN_USER', 'test-admin');
    vi.stubEnv('WAYFINDING_ADMIN_PASSWORD', 'test-password');
  }

  function reply(result: unknown) {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(), stderr: new EventEmitter(),
      stdin: Object.assign(new EventEmitter(), { end: vi.fn((_input: string) => {
        queueMicrotask(() => {
          child.stdout.emit('data', JSON.stringify(result));
          child.emit('close', 0);
        });
      }) }),
      kill: vi.fn(),
    });
    spawn.mockReturnValue(child);
    return child;
  }

  it('returns Floor 01 publication capabilities and preserves the worker load contract', async () => {
    authorize();
    const result = { revision: 'source-1', graph: { nodes: [], edges: [] },
      capabilities: { nodeMoves: true, nodeDeletion: true, sourceEdits: true, immediatePublish: true },
      runtimePublication: { floorId: '01', published: true, revision: 'publish-1', reloadRequired: true } };
    reply(result);
    const response = await GET(new Request('http://localhost:3666/api/admin/navigation?floorId=01', {
      headers: { authorization: `Basic ${Buffer.from('test-admin:test-password').toString('base64')}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(result);
    expect(spawn.mock.calls[0][1][0]).toMatch(/floor_01_admin_editor\.py$/);
    expect(spawn.mock.calls[0][2].env.WAYFINDING_NAVIGATION_STORE).toBeTruthy();
  });

  it('passes node moves and deletion directly to save without a diagnostics approval action', async () => {
    authorize();
    const result = { saved: true, revision: 'source-2', backup: 'backup-1',
      runtimePublication: { floorId: '01', published: true, revision: 'publish-2', reloadRequired: true } };
    const child = reply(result);
    const payload = { floorId: '01', action: 'save', revision: 'source-1',
      nodeMoves: { 'B03-01-node': [800, 900] }, deletedNodes: ['B03-01-other'] };
    const response = await POST(post(JSON.stringify(payload)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(JSON.parse(child.stdin.end.mock.calls[0][0])).toEqual(payload);
  });

  it('reports stale source revisions as conflict', async () => {
    authorize();
    reply({ error: 'Source revision changed. Reload before continuing.' });
    const response = await POST(post(JSON.stringify({ floorId: '01', action: 'save', revision: 'stale' })));
    expect(response.status).toBe(409);
  });

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
