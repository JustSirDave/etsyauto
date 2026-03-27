import type { Shop, User } from '@/lib/api';

/** Tenant shape aligned with auth/login tenant payload */
export interface MockTenant {
  id: number;
  name: string;
  role: string;
  description?: string | null;
  onboarding_completed?: boolean;
  messaging_access?: string;
}

export const mockTenant: MockTenant = {
  id: 1,
  name: 'Test Tenant',
  role: 'owner',
  description: null,
  onboarding_completed: true,
  messaging_access: 'none',
};

export const mockUser: User = {
  id: 101,
  email: 'user@test.com',
  name: 'Test User',
  tenant_id: mockTenant.id,
  tenant_name: mockTenant.name,
  role: 'owner',
  profile_picture_url: null,
  tenant_description: null,
  onboarding_completed: true,
  messaging_access: 'none',
};

export const mockApprovedUser: User = {
  ...mockUser,
  messaging_access: 'approved',
};

export const mockShop: Shop = {
  id: 1,
  etsy_shop_id: 'etsy-123',
  display_name: 'Test Shop',
  status: 'connected',
  created_at: '2024-01-01T00:00:00.000Z',
  token_health: {
    has_token: true,
    token_valid: true,
    expires_at: null,
    last_refreshed_at: null,
    refresh_count: 0,
  },
};

/** Valid activation token string (handlers should treat as valid) */
export const mockToken = 'valid-activation-token';
