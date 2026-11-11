import { adminAuthorized, adminDenied } from '../../../../../lib/admin-auth';
import { storeMedia, MAX_MEDIA_BYTES } from '../../../../../lib/media-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_REQUEST_BYTES = MAX_MEDIA_BYTES + 64_000;

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const hosts = [request.headers.get('host'), request.headers.get('x-forwarded-host')].flatMap(value => value?.split(',').map(part => part.trim()) || []);
  try { const parsed = new URL(origin || ''); return parsed.origin === origin && hosts.includes(parsed.host); } catch { return false; }
}

export async function POST(request: Request) {
  if (!adminAuthorized(request.headers)) return adminDenied();
  if (!sameOrigin(request) || request.headers.get('x-cms-editor') !== '1') return Response.json({ error: 'Same-origin CMS requests only' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) return Response.json({ error: 'Multipart form data required' }, { status: 415 });
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader !== null && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > MAX_REQUEST_BYTES)) {
    return Response.json({ error: 'Upload exceeds 20 MB' }, { status: 413 });
  }
  try {
    if (!request.body) return Response.json({ error: 'Choose one media file to upload' }, { status: 400 });
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return Response.json({ error: 'Upload exceeds 20 MB' }, { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const boundedRequest = new Request(request.url, { method: 'POST', headers: request.headers, body });
    const form = await boundedRequest.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose one media file to upload' }, { status: 400 });
    const result = await storeMedia(file);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 422 });
  }
}
