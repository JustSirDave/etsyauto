import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { mockApprovedUser, mockUser } from '../mocks/fixtures';
import { LanguageProvider } from '@/lib/language-context';
import { AuthProvider } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/Sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/owner',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderSidebar() {
    return render(
      <LanguageProvider>
        <AuthProvider>
          <Sidebar />
        </AuthProvider>
      </LanguageProvider>
    );
  }

  it('does not render Messages when messaging_access is none', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(
          { ...mockUser, messaging_access: 'none' },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /^Messages$/i })).toBeNull();
  });

  it('does not render Messages when messaging_access is pending', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(
          { ...mockUser, messaging_access: 'pending' },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Products$/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /^Messages$/i })).toBeNull();
  });

  it('renders Messages when messaging_access is approved', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockApprovedUser, {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-user-name')).toHaveTextContent(
        mockApprovedUser.name
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Messages$/i })).toBeInTheDocument();
    });
  });

  it('always renders Dashboard, Products, and Orders for owner', async () => {
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(
          { ...mockUser, role: 'owner' },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Products$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Orders$/i })).toBeInTheDocument();
    });
  });

  it('renders user name in footer', async () => {
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-user-name')).toHaveTextContent(mockUser.name);
    });
  });

  it('does not fetch unread messages when messaging is not approved', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(
          { ...mockUser, messaging_access: 'none' },
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    });
    const unreadCalls = fetchSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('/api/messages') && c[0].includes('unread')
    );
    expect(unreadCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });

  it('fetches unread count when messaging is approved', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(
      http.get('http://localhost/api/auth/me', () =>
        HttpResponse.json(mockApprovedUser, {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    renderSidebar();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Messages$/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      const hits = fetchSpy.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('/api/messages')
      );
      expect(hits.length).toBeGreaterThan(0);
    });
    fetchSpy.mockRestore();
  });
});
