/**
 * Google OAuth Callback Route
 * Handles the redirect from Google OAuth and forwards to backend
 */

import { NextRequest, NextResponse } from 'next/server';

// Server-side: must reach backend directly (Docker: api:8080, local: localhost:8080)
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:8080';

function buildLoginErrorRedirect(
  request: NextRequest,
  code: string,
  detail?: string
) {
  const url = new URL('/login', request.url);
  url.searchParams.set('auth_error', code);
  if (detail) {
    url.searchParams.set('auth_error_detail', detail);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return buildLoginErrorRedirect(request, 'google_oauth_error');
  }

  // Validate required parameters
  if (!code || !state) {
    return buildLoginErrorRedirect(request, 'missing_oauth_params');
  }

  try {
    // When running in Docker, localhost inside the web container is not the API.
    // Try configured URL first, then internal service URL.
    const callbackPath = '/api/oauth/google/callback';
    const candidateBaseUrls = [API_INTERNAL_URL];
    let response: Response | null = null;
    let networkError: unknown = null;

    for (const baseUrl of candidateBaseUrls) {
      try {
        response = await fetch(`${baseUrl}${callbackPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state,
          }),
        });
        break;
      } catch (err) {
        networkError = err;
      }
    }

    if (!response) {
      throw networkError ?? new Error('OAuth callback request failed');
    }

    if (!response.ok) {
      let detail: string | undefined;
      try {
        const errData = await response.json();
        detail = typeof errData?.detail === 'string' ? errData.detail : undefined;
      } catch {
        // Response body may not be JSON
      }
      return buildLoginErrorRedirect(request, 'oauth_callback_rejected', detail);
    }

    // Check if backend returned a redirect
    const redirectLocation = response.headers.get('location');
    if (redirectLocation) {
      const redirectResponse = NextResponse.redirect(redirectLocation);
      // Forward Set-Cookie headers from backend so auth cookies reach the user's browser
      const setCookies = response.headers.getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        for (const cookie of setCookies) {
          redirectResponse.headers.append('Set-Cookie', cookie);
        }
      } else {
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          redirectResponse.headers.append('Set-Cookie', setCookie);
        }
      }
      return redirectResponse;
    }

    // If backend returns JSON with redirect URL
    const data = await response.json().catch(() => null);
    if (data?.redirect_url) {
      return NextResponse.redirect(data.redirect_url);
    }

    // Default fallback - redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    return buildLoginErrorRedirect(request, 'oauth_callback_failed');
  }
}
