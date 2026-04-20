import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Gate indexing on the canonical host. Any other host — preview deploys
// ({project}-git-{branch}-{id}.vercel.app), future aliases, or the
// now-removed www / vercel.app subdomain if a cache still resolves it —
// gets X-Robots-Tag: noindex, nofollow so Google (and other crawlers
// that respect the header) won't index duplicate content.
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const response = NextResponse.next();
  if (host !== 'alexwelcing.com') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|api/).*)',
};
