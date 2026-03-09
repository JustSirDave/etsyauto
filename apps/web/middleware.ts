import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware — proxies /api/* to the FastAPI backend and
 * protects dashboard routes by checking for the HttpOnly access_token cookie.
 *
 * API_INTERNAL_URL: Docker = http://api:8080 | local dev = http://localhost:8080
 */

function getApiTarget(): string {
  return (process.env.API_INTERNAL_URL || 'http://api:8080').replace(/\/+$/, '');
}

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

const PUBLIC_PREFIXES = [
  '/api/',
  '/oauth/',
  '/_next/',
  '/favicon',
  '/uploads/',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ------------------------------------------------------------------ */
  /*  Proxy /api/* to backend                                           */
  /* ------------------------------------------------------------------ */
  if (pathname.startsWith('/api/')) {
    const proxyUrl = `${getApiTarget()}${pathname}${request.nextUrl.search}`;

    // Forward only headers we need — Edge Runtime can throw "Illegal invocation"
    // when using headers.forEach() or iterating over request/response headers.
    const fwdHeaders: Record<string, string> = {};
    const copyHeader = (name: string) => {
      const v = request.headers.get(name);
      if (v) fwdHeaders[name] = v;
    };
    copyHeader('cookie');
    copyHeader('content-type');
    copyHeader('authorization');
    copyHeader('accept');
    copyHeader('accept-language');
    copyHeader('idempotency-key');

    try {
      // Do not pass request.body to fetch — Edge throws "Illegal invocation".
      // Read body as text when present and pass the string.
      let body: string | undefined;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          body = await request.text();
        } catch {
          body = undefined;
        }
      }
      if (body !== undefined && body !== '' && !fwdHeaders['content-type']) {
        fwdHeaders['content-type'] = 'application/json';
      }

      const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
      const timeoutMs = isMutating ? 15000 : 5000;

      const res = await fetch(proxyUrl, {
        method: request.method,
        headers: fwdHeaders,
        body: body || undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Use res.text() — res.arrayBuffer() can throw "Illegal invocation" in Edge
      const bodyText = await res.text();

      // Copy only headers we need; avoid getSetCookie() (can throw in Edge)
      const resHeaders = new Headers();
      const ct = res.headers.get('content-type');
      if (ct) resHeaders.set('content-type', ct);
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) resHeaders.set('set-cookie', setCookie);
      resHeaders.set('x-middleware-cache', 'no-store');

      // Rewrite redirect Location from backend host to same-origin path so the browser can follow
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (loc) {
          try {
            const u = new URL(loc);
            const sameOriginPath = u.pathname + u.search;
            resHeaders.set('location', sameOriginPath);
          } catch {
            resHeaders.set('location', loc);
          }
        }
      }

      return new NextResponse(bodyText, {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[middleware] API proxy error:', proxyUrl, msg);
      return NextResponse.json({ detail: 'Backend unreachable' }, { status: 502 });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Auth guard for non-public routes                                  */
  /* ------------------------------------------------------------------ */
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  if (/\.\w+$/.test(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
