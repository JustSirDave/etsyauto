import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  mockApprovedUser,
  mockShop,
  mockToken,
  mockUser,
} from '../../mocks/fixtures';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from '@/lib/language-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { ToastProvider } from '@/lib/toast-context';
import { AuthProvider } from '@/lib/auth-context';
import { ShopProvider } from '@/lib/shop-context';
import { SettingsContent } from '@/app/settings/page';
import { MessagingActivationWizard } from '@/components/settings/MessagingActivationWizard';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams('tab=connections'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: nav.push,
    replace: nav.replace,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => nav.params,
  usePathname: () => '/settings',
}));

function renderSettings() {
  return render(
    <GoogleOAuthProvider clientId="test">
      <LanguageProvider>
        <CurrencyProvider>
          <ToastProvider>
            <AuthProvider>
              <ShopProvider>
                <SettingsContent />
              </ShopProvider>
            </AuthProvider>
          </ToastProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}

function renderWizard(token: string) {
  return render(
    <GoogleOAuthProvider clientId="test">
      <LanguageProvider>
        <CurrencyProvider>
          <ToastProvider>
            <AuthProvider>
              <ShopProvider>
                <MessagingActivationWizard token={token} />
              </ShopProvider>
            </AuthProvider>
          </ToastProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}

describe('Settings messaging tab', () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.replace.mockClear();
    nav.params = new URLSearchParams('tab=connections');
    server.use(
      http.get('http://localhost/api/shops/', () =>
        HttpResponse.json(
          { shops: [{ ...mockShop }] },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
  });

  it('shows contact support when messaging_access is none and no token', async () => {
    nav.params = new URLSearchParams('tab=messaging');
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockUser, { headers: { 'Content-Type': 'application/json' } })
      )
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/contact support/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/support@etsyauto\.com/i)).toBeInTheDocument();
  });

  it('hides Messaging tab when not approved and no token', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockUser, { headers: { 'Content-Type': 'application/json' } })
      )
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connections/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^Messaging$/i })).toBeNull();
  });

  it('shows Messaging tab when approved', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockApprovedUser, {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Messaging$/i })).toBeInTheDocument();
    });
  });

  it('shows normal IMAP form when approved and no token', async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams('tab=messaging');
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockApprovedUser, {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    server.use(
      http.get('http://localhost/api/shops/1/messaging-config', () =>
        HttpResponse.json(
          {
            imap_host: 'imap.test.com',
            imap_email: 'a@b.com',
            adspower_profile_id: 'p1',
          },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Messaging Automation/i)).toBeInTheDocument();
    });
    const shopSelect = screen.getByRole('combobox');
    await user.selectOptions(shopSelect, String(mockShop.id));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/imap\.gmail\.com/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('imap.test.com')).toBeInTheDocument();
  });
});

describe('MessagingActivationWizard', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.push.mockClear();
  });

  it('shows wizard with token in settings flow', async () => {
    nav.params = new URLSearchParams(`tab=messaging&token=${encodeURIComponent(mockToken)}`);
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockUser, { headers: { 'Content-Type': 'application/json' } })
      )
    );
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });
  });

  it('Step 1: Continue disabled until both checkboxes checked', async () => {
    const user = userEvent.setup();
    renderWizard(mockToken);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Continue$/i })).toBeDisabled();
    });
    const cbs = screen.getAllByRole('checkbox');
    await user.click(cbs[0]!);
    expect(screen.getByRole('button', { name: /^Continue$/i })).toBeDisabled();
    await user.click(cbs[1]!);
    expect(screen.getByRole('button', { name: /^Continue$/i })).toBeEnabled();
  });

  it('advances through steps and POST activate with expected payload', async () => {
    const user = userEvent.setup();
    let captured: unknown;
    server.use(
      http.post('http://localhost/api/messaging/activate', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          { success: true },
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    const { container } = renderWizard(mockToken);
    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });
    for (const cb of screen.getAllByRole('checkbox')) {
      await user.click(cb);
    }
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Connect Your Gmail/i)).toBeInTheDocument();
    });
    const step2Inputs = container.querySelectorAll<HTMLInputElement>(
      'input:not([type="checkbox"])'
    );
    expect(step2Inputs.length).toBeGreaterThanOrEqual(3);
    await user.clear(step2Inputs[0]!);
    await user.type(step2Inputs[0]!, 'imap.custom.com');
    await user.type(step2Inputs[1]!, 'shop@mail.com');
    await user.type(step2Inputs[2]!, 'app-pass-123');
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Connect AdsPower/i)).toBeInTheDocument();
    });
    const profileInput = container.querySelector<HTMLInputElement>(
      'input:not([type="checkbox"])'
    );
    expect(profileInput).toBeTruthy();
    await user.type(profileInput!, 'profile-xyz');
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Activate Messaging Access/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Activate Messaging Access/i }));
    await waitFor(() => {
      expect(captured as Record<string, unknown>).toMatchObject({
        token: mockToken,
        imap_host: 'imap.custom.com',
        imap_email: 'shop@mail.com',
        imap_password: 'app-pass-123',
        adspower_profile_id: 'profile-xyz',
        accepted_terms: true,
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/Messaging access activated/i)).toBeInTheDocument();
    });
  });

  it('shows error when activation returns 400', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost/api/messaging/activate', () =>
        HttpResponse.json(
          { detail: 'Bad activation request' },
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    const { container } = renderWizard('bad-payload-token');
    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });
    for (const cb of screen.getAllByRole('checkbox')) {
      await user.click(cb);
    }
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));
    const inputs2 = container.querySelectorAll<HTMLInputElement>(
      'input:not([type="checkbox"])'
    );
    await user.type(inputs2[1]!, 'e@e.com');
    await user.type(inputs2[2]!, 'pw');
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));
    const profile = container.querySelector<HTMLInputElement>(
      'input:not([type="checkbox"])'
    );
    await user.type(profile!, 'id1');
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));
    await user.click(screen.getByRole('button', { name: /Activate Messaging Access/i }));
    await waitFor(() => {
      expect(screen.getByText(/Bad activation request/i)).toBeInTheDocument();
    });
  });
});
