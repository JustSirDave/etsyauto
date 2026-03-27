import { http, HttpResponse } from 'msw';
import { mockShop, mockTenant, mockToken, mockUser } from './fixtures';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const handlers = [
  http.get('http://localhost/api/auth/me', () =>
    HttpResponse.json(mockUser, { headers: jsonHeaders })
  ),

  http.post('http://localhost/api/auth/login', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    if (body.password === 'fail-401') {
      return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
    }
    if (body.password === 'fail-500') {
      return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
    }
    return HttpResponse.json(
      {
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: mockUser.id,
          email: body.email || mockUser.email,
          name: mockUser.name,
          email_verified: true,
          profile_picture_url: null,
        },
        tenant: {
          id: mockTenant.id,
          name: mockTenant.name,
          role: mockTenant.role,
          description: null,
          onboarding_completed: true,
          messaging_access: mockTenant.messaging_access ?? 'none',
        },
      },
      { headers: jsonHeaders }
    );
  }),

  http.post('http://localhost/api/auth/logout', () =>
    HttpResponse.json({ message: 'ok' }, { headers: jsonHeaders })
  ),

  http.post('http://localhost/api/auth/refresh', () =>
    HttpResponse.json({ ok: true }, { headers: jsonHeaders })
  ),

  http.get('http://localhost/api/shops/', () =>
    HttpResponse.json({ shops: [mockShop] }, { headers: jsonHeaders })
  ),

  http.get('http://localhost/api/notifications/unread-count', () =>
    HttpResponse.json({ count: 0 }, { headers: jsonHeaders })
  ),

  http.get('http://localhost/api/messages', ({ request }) => {
    const u = new URL(request.url);
    const page = Number(u.searchParams.get('page') || '1');
    const limit = Number(u.searchParams.get('limit') || '20');
    return HttpResponse.json(
      {
        threads: [],
        total: 0,
        page,
        limit,
      },
      { headers: jsonHeaders }
    );
  }),

  http.get('http://localhost/api/messaging/activate', ({ request }) => {
    const token = new URL(request.url).searchParams.get('token');
    if (token === mockToken) {
      return HttpResponse.json(
        {
          valid: true,
          tenant_name: 'Test Tenant',
          email: 'test@test.com',
        },
        { headers: jsonHeaders }
      );
    }
    if (token === 'expired-token') {
      return HttpResponse.json(
        { valid: false, reason: 'expired' },
        { headers: jsonHeaders }
      );
    }
    if (token === 'used-token') {
      return HttpResponse.json(
        { valid: false, reason: 'used' },
        { headers: jsonHeaders }
      );
    }
    return HttpResponse.json(
      { valid: false, reason: 'not_found' },
      { headers: jsonHeaders }
    );
  }),

  http.post('http://localhost/api/messaging/activate', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    if (body.token === 'bad-payload-token') {
      return HttpResponse.json(
        { detail: 'Invalid activation payload' },
        { status: 400, headers: jsonHeaders }
      );
    }
    return HttpResponse.json({ success: true }, { headers: jsonHeaders });
  }),
];

/** Scenarios for error demos in tests (use via server.use) */
export const authFailure401 = http.get('http://localhost/api/auth/me', () =>
  HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
);

export const refreshFailure401 = http.post(
  'http://localhost/api/auth/refresh',
  () => HttpResponse.json({ detail: 'No refresh' }, { status: 401 })
);

export const messagingForbidden403 = http.get(
  'http://localhost/api/messages',
  () =>
    HttpResponse.json({ detail: 'Messaging not approved' }, { status: 403 })
);

export const serverError500 = http.get('http://localhost/api/auth/me', () =>
  HttpResponse.json({ detail: 'Internal error' }, { status: 500 })
);
