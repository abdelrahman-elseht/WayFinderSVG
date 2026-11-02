import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { adminAuthorized, adminDenied } from '../../../../lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const root = existsSync(path.join(process.cwd(), 'scripts/semantic-map/admin_editor.py')) ? process.cwd() : path.resolve(process.cwd(), '../..');
let active = 0;

async function worker(payload: unknown) {
  if (active >= 2) throw new Error('Editor busy. Retry after the current validation completes.');
  active++;
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const local = path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
      const executable = process.env.PYTHON_EXECUTABLE || (existsSync(local) ? local : 'python');
      const child = spawn(executable, [path.join(root, 'scripts/semantic-map/admin_editor.py')], {
        cwd: root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      let output = '', error = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('Reconstruction timed out; check recovery journal before retrying a save.')); }, 240_000);
      child.stdout.on('data', data => { output += data; if (output.length > 32_000_000) child.kill(); });
      child.stderr.on('data', data => { error = (error + data).slice(-4000); });
      child.on('error', err => { clearTimeout(timer); reject(err); });
      child.stdin.on('error', () => { /* Exit/error handler provides the diagnostic. */ });
      child.on('close', code => {
        clearTimeout(timer);
        try { const result = JSON.parse(output); if (code || result.error) reject(new Error(result.error || 'Worker failed')); else resolve(result); }
        catch (err) { reject(err instanceof SyntaxError ? new Error(`Geometry worker failed: ${error}`) : err); }
      });
      child.stdin.end(JSON.stringify(payload));
    });
  } finally { active--; }
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  if (!adminAuthorized(request.headers)) return adminDenied();
  try { return json(await worker({ action: 'load' })); }
  catch (error) { return json({ error: String(error) }, 503); }
}

export async function POST(request: Request) {
  if (!adminAuthorized(request.headers)) return adminDenied();
  const origin = request.headers.get('origin');
  const hosts = [request.headers.get('host'), request.headers.get('x-forwarded-host')]
    .flatMap(value => value?.split(',').map(part => part.trim()) || [])
    .filter(Boolean);
  const protocols = [new URL(request.url).protocol.slice(0, -1), request.headers.get('x-forwarded-proto')]
    .flatMap(value => value?.split(',').map(part => part.trim()) || [])
    .filter(Boolean);
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || '');
    sameOrigin = parsed.origin === origin && hosts.includes(parsed.host) && protocols.includes(parsed.protocol.slice(0, -1));
  } catch { /* Missing or malformed Origin fails closed. */ }
  if (!sameOrigin || request.headers.get('x-navigation-editor') !== '1') return json({ error: 'Same-origin editor requests only' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Body required' }, 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 300_000) { await reader.cancel(); return json({ error: 'Draft exceeds 300 KB' }, 413); }
    chunks.push(value);
  }
  try { return json(await worker(JSON.parse(Buffer.concat(chunks).toString('utf8')))); }
  catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 422); }
}
