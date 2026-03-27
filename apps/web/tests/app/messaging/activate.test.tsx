import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { mockToken, mockUser } from '../../mocks/fixtures';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from '@/lib/language-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { ToastProvider } from '@/lib/toast-context';
import { AuthProvider } from '@/lib/auth-context';
import { ShopProvider } from '@/lib/shop-context';
import MessagingActivatePage from '@/app/messaging/activate/page';

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: nav.push,
    replace: nav.replace,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => nav.params,
}));

function renderPage() {
  return render(
    <GoogleOAuthProvider clientId="test">
      <LanguageProvider>
        <CurrencyProvider>
          <ToastProvider>
            <AuthProvider>
              <ShopProvider>
                <MessagingActivatePage />
              </ShopProvider>
            </AuthProvider>
          </ToastProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}

describe('MessagingActivatePage', () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.replace.mockClear();
    nav.params = new URLSearchParams();
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockUser, { headers: { 'Content-Type': 'application/json' } })
      )
    );
  });

  it('shows error when token is invalid (valid: false)', async () => {
    nav.params = new URLSearchParams('token=invalid-token-xyz');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Link not valid/i)).toBeInTheDocument();
    });
  });

  it('shows error when token is expired', async () => {
    nav.params = new URLSearchParams('token=expired-token');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  it('shows error when token is already used', async () => {
    nav.params = new URLSearchParams('token=used-token');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/already been used/i)).toBeInTheDocument();
    });
  });

  it('shows Continue to setup when token is valid', async () => {
    nav.params = new URLSearchParams(`token=${encodeURIComponent(mockToken)}`);
    renderPage();
    await waitFor(() => {
      const link = screen.queryByRole('link', { name: /Continue to setup/i });
      const btn = screen.queryByRole('button', { name: /Continue to setup/i });
      expect(link || btn).toBeTruthy();
    });
  });

  it('Continue link points to login with redirect when not logged in', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () => new HttpResponse(null, { status: 401 })),
      http.post('http://localhost/api/auth/refresh', () => new HttpResponse(null, { status: 401 }))
    );
    nav.params = new URLSearchParams(`token=${encodeURIComponent(mockToken)}`);
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Continue to setup/i });
      expect(link.getAttribute('href')).toContain('/login?redirect=');
    });
  });

  it('redirects to settings with token when logged in and token valid', async () => {
    nav.params = new URLSearchParams(`token=${encodeURIComponent(mockToken)}`);
    renderPage();
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith(
        `/settings?tab=messaging&token=${encodeURIComponent(mockToken)}`
      );
    });
  });

});
