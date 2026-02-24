import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware — protects dashboard routes by checking
 * for the HttpOnly `access_token` cookie.  Runs at the Edge before
 * any page renders, preventing flash-of-protected-content.
 * Also proxies /api/* to the backend when rewrites fail.
 */

const API_TARGET = process.env.API_INTERNAL_URL || 'http://api:8080';

/** Routes that do NOT require authentication */
const PUBLIC_PATHS = new Set([
  '/',
  '/landing',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invitation',
  '/privacy',
  '/terms',
]);

/** Path prefixes that should always be accessible */
const PUBLIC_PREFIXES = [
  '/api/',       // API routes are guarded by the backend
  '/oauth/',     // OAuth callback flows
  '/_next/',     // Next.js internal
  '/favicon',
  '/uploads/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy /api/* to backend (rewrites can fail in some setups)
  if (pathname.startsWith('/api/')) {
    const url = `${API_TARGET}${pathname}${request.nextUrl.search}`;
    const headers = new Headers(request.headers);
    headers.delete('host');
    const init: RequestInit = { method: request.method, headers };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.text();
        if (body) {
          init.body = body;
          headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
        }
      } catch { /* body may be empty */ }
    }
    try {
      const res = await fetch(url, init);
      const resHeaders = new Headers(res.headers);
      resHeaders.set('x-middleware-cache', 'no-store');
      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
      });
    } catch (e) {
      console.error('[middleware] API proxy error:', e);
      return NextResponse.json({ detail: 'Backend unreachable' }, { status: 502 });
    }
  }

  // 1. Allow public paths
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // 2. Allow public prefixes (api already handled above)
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  // 3. Allow static assets (images, fonts, etc.)
  if (/\.\w+$/.test(pathname)) {
    return NextResponse.next();
  }

  // 4. Check for the access_token cookie
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    // Redirect to login with a `next` query param so the user
    // returns to the page they wanted after logging in.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — let the request through.
  // The backend will validate the JWT itself; if it's expired the
  // frontend 401 interceptor will attempt a refresh.
  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image).*)'],
};
