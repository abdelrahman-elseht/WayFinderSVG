import { createHash, timingSafeEqual } from 'node:crypto';

/** Dedicated admin credentials until the project has an identity provider. Fail closed. */
export function adminAuthorized(headers: Headers): boolean {
  const username = process.env.WAYFINDING_ADMIN_USER;
  const password = process.env.WAYFINDING_ADMIN_PASSWORD;
  if (!username || !password || password.length < 5) return false;
  const header = headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;
  const supplied = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(supplied), hash(`${username}:${password}`));
}

export function adminDenied() {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Navigation editor authorization</title><body><main><h1>Administrator authorization required</h1><p>Configure WAYFINDING_ADMIN_USER and WAYFINDING_ADMIN_PASSWORD with a password of at least 5 characters, then restart the Next.js server.</p><p>Credentials are not configured on this server or were rejected.</p><p>See docs/navigation-editor-admin.md.</p></main></body></html>`, {
    status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'WWW-Authenticate': 'Basic realm="B03 Navigation Editor", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}
