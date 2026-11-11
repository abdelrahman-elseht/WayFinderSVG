import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const allowed = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'],
  ['video/mp4', '.mp4'], ['video/webm', '.webm'],
]);
const root = () => path.resolve(process.env.WAYFINDING_MEDIA_STORE || path.join(process.cwd(), '.data', 'media'));

export function validateMediaUpload(file: { name: string; type: string; size: number }) {
  const extension = allowed.get(file.type);
  if (!extension) throw new Error('Unsupported media type. Use JPEG, PNG, WebP, MP4, or WebM.');
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_MEDIA_BYTES) throw new Error('File must be between 1 byte and 20 MB.');
  if (file.name.length > 180 || /[\\/\0-\x1f\x7f]/.test(file.name) || file.name === '.' || file.name === '..') throw new Error('Unsafe filename. Rename the file and try again.');
  if (path.extname(file.name).toLowerCase() !== extension) throw new Error('Filename extension does not match the declared media type.');
  return extension;
}

export async function storeMedia(file: File) {
  const extension = validateMediaUpload(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const signature = extension === '.jpg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    : extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : extension === '.webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    : extension === '.mp4' ? bytes.toString('ascii', 4, 8) === 'ftyp'
    : bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!signature) throw new Error('File contents do not match the declared media type.');
  const base = root();
  await mkdir(base, { recursive: true });
  const safeRoot = await realpath(base);
  const name = `${createHash('sha256').update(randomUUID()).digest('hex')}${extension}`;
  const target = path.join(safeRoot, name);
  if (path.dirname(target) !== safeRoot) throw new Error('Invalid media destination.');
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
  return { url: `/api/media/${name}`, type: file.type };
}

export async function readStoredMedia(name: string) {
  if (!/^[a-f0-9]{64}\.(?:jpg|png|webp|mp4|webm)$/.test(name)) return null;
  const base = root();
  try {
    const safeRoot = await realpath(base);
    const target = path.resolve(safeRoot, name);
    if (path.dirname(target) !== safeRoot) return null;
    const { readFile } = await import('node:fs/promises');
    return { bytes: await readFile(target), type: [...allowed].find(([, ext]) => ext === path.extname(name))?.[0] };
  } catch { return null; }
}
