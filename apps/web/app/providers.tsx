'use client';

/**
 * Client-side Providers Wrapper
 * Separates client components from server layout
 */

import { AuthProvider } from '@/lib/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
