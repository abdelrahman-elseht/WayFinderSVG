import { adminAuthorized, adminDenied } from '../../../../lib/admin-auth';
import { contentRevision, isCmsFloorId, readContentState, StaleContentRevisionError, writeContentState } from '../../../../lib/content-store';
import floor from '@data/buildings/B03/GF.json';
import graph from '@data/buildings/B03/GF.graph.json';
import firstFloor from '@data/buildings/B03/01.json';
import firstGraph from '@data/buildings/B03/01.graph.json';
import { validateColorGroups, validateFloorBundle, type RoomContent } from '@wayfinding/map-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (value: unknown, status = 200) => Response.json(value, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const hosts = [request.headers.get('host'), request.headers.get('x-forwarded-host')]
    .flatMap(value => value?.split(',').map(part => part.trim()) || []).filter(Boolean);
  try {
    const parsed = new URL(origin || '');
    return parsed.origin === origin && hosts.includes(parsed.host);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!adminAuthorized(request.headers)) return adminDenied();
  const floorId = new URL(request.url).searchParams.get('floorId');
  if (!isCmsFloorId(floorId)) return json({ error: 'floorId must be GF or 01' }, 400);
  try {
    const state = await readContentState(floorId);
    const data = floorId === 'GF' ? floor : firstFloor;
    return json({ ...state, floorId, floor: data.floor, rooms: data.rooms, revision: contentRevision(state, floorId) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 503);
  }
}

export async function POST(request: Request) {
  if (!adminAuthorized(request.headers)) return adminDenied();
  if (!sameOrigin(request) || request.headers.get('x-cms-editor') !== '1') {
    return json({ error: 'Same-origin CMS requests only' }, 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Body required' }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 300_000) {
        await reader.cancel();
        return json({ error: 'Content draft exceeds 300 KB' }, 413);
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { action?: string; contents?: unknown; colorGroups?: unknown; revision?: string; floorId?: unknown };
    const floorId = body.floorId;
    if (!isCmsFloorId(floorId)) return json({ error: 'floorId must be GF or 01' }, 400);
    const contents = body.contents as RoomContent[] | undefined;
    if (!Array.isArray(contents)) return json({ error: 'contents must be an array' }, 400);
    if (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) return json({ error: 'A valid content revision is required' }, 400);
    const selectedFloor = floorId === 'GF' ? floor : firstFloor;
    const selectedGraph = floorId === 'GF' ? graph : firstGraph;
    validateFloorBundle(selectedFloor, selectedGraph, contents, { allowUnsafeGeometry: true });
    const state = await readContentState(floorId);
    const colorGroups = validateColorGroups(body.colorGroups === undefined ? state.draftColorGroups : body.colorGroups, contents);
    if (body.action === 'save') {
      const revision = await writeContentState({ ...state, floorId, draft: contents, draftColorGroups: colorGroups }, body.revision, floorId);
      return json({ ok: true, status: 'draft', contents, revision });
    }
    if (body.action === 'publish') {
      const revision = await writeContentState({ floorId, draft: contents, published: contents, draftColorGroups: colorGroups, publishedColorGroups: colorGroups }, body.revision, floorId);
      return json({ ok: true, status: 'published', contents, revision });
    }
    return json({ error: 'action must be save or publish' }, 400);
  } catch (error) {
    if (error instanceof StaleContentRevisionError) return json({ error: error.message }, 409);
    return json({ error: error instanceof Error ? error.message : String(error) }, 422);
  }
}
