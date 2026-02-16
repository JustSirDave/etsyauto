import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware — protects dashboard routes by checking
 * for the HttpOnly `access_token` cookie.  Runs at the Edge before
 * any page renders, preventing flash-of-protected-content.
 */

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public paths
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // 2. Allow public prefixes
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
