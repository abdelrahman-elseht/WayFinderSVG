import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GET } from '../../apps/web/app/api/navigation/[floorId]/route';

let temporaryDirectory = '';

afterEach(async () => {
  vi.unstubAllEnvs();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = '';
});

describe('public navigation bundle endpoint', () => {
  it('serves stale revisions without cache and matching revisions immutably', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'wayfinding-public-navigation-'));
    vi.stubEnv('WAYFINDING_NAVIGATION_STORE', path.join(temporaryDirectory, 'navigation.json'));
    vi.stubEnv('WAYFINDING_CONTENT_STORE', path.join(temporaryDirectory, 'content.json'));

    const stale = await GET(new Request('http://localhost/api/navigation/01?revision=stale'), {
      params: Promise.resolve({ floorId: '01' }),
    });
    const payload = await stale.json() as { revision: string; bundle: { graph: { edges: unknown[] }; floorData: { floor: { mapAsset: string } } } };
    expect(stale.status).toBe(409);
    expect(stale.headers.get('cache-control')).toBe('no-store');
    expect(payload.bundle.graph.edges.length).toBeGreaterThan(0);
    expect(payload.bundle.floorData.floor.mapAsset).toMatch(/\?v=[a-f0-9]{16}$/);

    const current = await GET(new Request(`http://localhost/api/navigation/01?revision=${payload.revision}`), {
      params: Promise.resolve({ floorId: '01' }),
    });
    expect(current.status).toBe(200);
    expect(current.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});
