import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { mockShop } from '../mocks/fixtures';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from '@/lib/language-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { ToastProvider } from '@/lib/toast-context';
import { AuthProvider } from '@/lib/auth-context';
import { ShopProvider } from '@/lib/shop-context';
import { TopBar } from '@/components/layout/TopBar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

function renderTopBar() {
  return render(
    <GoogleOAuthProvider clientId="test-client">
      <LanguageProvider>
        <CurrencyProvider>
          <ToastProvider>
            <AuthProvider>
              <ShopProvider>
                <TopBar />
              </ShopProvider>
            </AuthProvider>
          </ToastProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}

describe('TopBar shop selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No shop connected" when shops array is empty', async () => {
    server.use(
      http.get('http://localhost/api/shops/', () =>
        HttpResponse.json({ shops: [] }, { headers: { 'Content-Type': 'application/json' } })
      )
    );
    renderTopBar();
    await waitFor(() => {
      expect(screen.getByTitle(/select shop/i)).toHaveTextContent(
        /No shop connected/i
      );
    });
  });

  it('shows label when one shop is connected (all selected → "All shops")', async () => {
    server.use(
      http.get('http://localhost/api/shops/', () =>
        HttpResponse.json(
          { shops: [{ ...mockShop, id: 1, display_name: 'Solo Shop' }] },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderTopBar();
    await waitFor(() => {
      expect(screen.getByTitle(/select shop/i)).toHaveTextContent(/All shops/i);
    });
  });

  it('opens dropdown with multiple shops', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('http://localhost/api/shops/', () =>
        HttpResponse.json(
          {
            shops: [
              { ...mockShop, id: 1, display_name: 'Alpha' },
              { ...mockShop, id: 2, display_name: 'Beta', etsy_shop_id: 'etsy-999' },
            ],
          },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderTopBar();
    const shopBtn = await waitFor(() => screen.getByTitle(/select shop/i));
    await waitFor(() => {
      expect(shopBtn).not.toHaveTextContent(/Loading/i);
    });
    await user.click(shopBtn);
    await waitFor(() => {
      expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Beta').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows loading state while shops are loading', async () => {
    server.use(
      http.get('http://localhost/api/shops/', async () => {
        await new Promise((r) => setTimeout(r, 400));
        return HttpResponse.json({ shops: [] }, {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    renderTopBar();
    const shopBtn = screen.getByTitle(/select shop/i);
    expect(shopBtn).toHaveTextContent(/Loading/i);
  });
});
