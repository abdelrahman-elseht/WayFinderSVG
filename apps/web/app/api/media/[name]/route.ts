import { readStoredMedia } from '../../../../lib/media-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const media = await readStoredMedia(name);
  if (!media?.type) return new Response('Not found', { status: 404 });
  return new Response(media.bytes, { headers: { 'Content-Type': media.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
