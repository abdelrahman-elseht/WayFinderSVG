import { NextResponse, type NextRequest } from 'next/server';
import { adminAuthorized, adminDenied } from './lib/admin-auth';

export function proxy(request: NextRequest) {
  if (!adminAuthorized(request.headers)) return adminDenied();
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return response;
}
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
