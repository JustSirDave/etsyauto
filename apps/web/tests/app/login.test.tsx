import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from '@/lib/language-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { ToastProvider } from '@/lib/toast-context';
import { AuthProvider } from '@/lib/auth-context';
import LoginPage from '@/app/login/page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/GoogleSignInButton', () => ({
  default: function MockGoogle() {
    return <button type="button">Continue with Google</button>;
  },
}));

function renderLogin() {
  return render(
    <GoogleOAuthProvider clientId="test">
      <LanguageProvider>
        <CurrencyProvider>
          <ToastProvider>
            <AuthProvider>
              <LoginPage />
            </AuthProvider>
          </ToastProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('renders email and password fields', async () => {
    renderLogin();
    await waitFor(() => {
      expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
  });

  it('disables submit when email or password empty', async () => {
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeDisabled();
  });

  it('calls POST /api/auth/login with email and password on submit', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post('http://localhost/api/auth/login', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            token_type: 'bearer',
            expires_in: 3600,
            user: {
              id: 1,
              email: 'a@b.com',
              name: 'N',
            },
            tenant: {
              id: 1,
              name: 'T',
              role: 'owner',
              messaging_access: 'none',
            },
          },
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/^Email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'secret');
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));
    await waitFor(() => {
      expect(body as Record<string, string>).toMatchObject({
        email: 'a@b.com',
        password: 'secret',
      });
    });
  });

  it('redirects to role dashboard on success', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost/api/auth/login', () =>
        HttpResponse.json(
          {
            token_type: 'bearer',
            expires_in: 3600,
            user: { id: 1, email: 'a@b.com', name: 'N' },
            tenant: {
              id: 1,
              name: 'T',
              role: 'owner',
              messaging_access: 'none',
            },
          },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/^Email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'ok');
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard/owner');
    });
  });

  it('shows error on 401', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost/api/auth/login', () =>
        HttpResponse.json({ detail: 'Nope' }, { status: 401 })
      )
    );
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/^Email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('shows safe error on 500', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost/api/auth/login', () =>
        HttpResponse.json({ detail: 'DB exploded' }, { status: 500 })
      )
    );
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/^Email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'x');
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Login failed/i)).toBeInTheDocument();
    });
  });

  it('renders Google OAuth button', async () => {
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
    });
  });
});
