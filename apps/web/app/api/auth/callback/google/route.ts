/**
 * Google OAuth Callback Route
 * Handles the redirect from Google OAuth and forwards to backend
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://api:8080';

function buildLoginErrorRedirect(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?auth_error=${encodeURIComponent(code)}`, request.url));
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
    const candidateBaseUrls = [API_BASE_URL, API_INTERNAL_URL].filter(
      (url, index, all) => Boolean(url) && all.indexOf(url) === index
    );
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
      return buildLoginErrorRedirect(request, 'oauth_callback_rejected');
    }

    // Check if backend returned a redirect
    const redirectLocation = response.headers.get('location');
    if (redirectLocation) {
      return NextResponse.redirect(redirectLocation);
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
