/**
 * API Client for Etsy Automation Platform
 * Handles all HTTP requests to the FastAPI backend
 */

// Use local API routes for demo, or external API if specified
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8080');

export interface ApiError {
  detail: string;
  status: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenant_name: string;
}

export interface GoogleAuthRequest {
  google_token: string;
  tenant_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    email: string;
    name: string;
    email_verified?: boolean;
    profile_picture_url?: string | null;
    is_new_user?: boolean;  // For post-login onboarding detection
  };
  tenant: {
    id: number;
    name: string;
    role: string;
    description?: string | null;
    onboarding_completed?: boolean;
  };
}

export interface User {
  id: number;
  email: string;
  name: string;
  profile_picture_url?: string | null;
  tenant_id: number;
  tenant_name: string;
  role: string;
  tenant_description?: string | null;
  onboarding_completed?: boolean;
}

export interface Shop {
  id: number;
  etsy_shop_id: string;
  display_name: string;
  status: string;
  created_at: string;
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Set auth token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

/**
 * Remove auth token from localStorage
 */
export function removeAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}

/**
 * Generic API request handler
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle non-2xx responses as errors
  if (!response.ok) {
    const error: ApiError = {
      detail: 'An error occurred',
      status: response.status,
    };

    try {
      const errorData = await response.json();
      error.detail = errorData.detail || errorData.message || 'An error occurred';
    } catch (e) {
      error.detail = response.statusText || 'An error occurred';
    }

    throw error;
  }

  // Special handling for 202 Accepted (used for email verification required)
  // FastAPI's HTTPException returns {"detail": "..."} format
  if (response.status === 202) {
    const data = await response.json();
    const error: ApiError = {
      detail: data.detail || 'Action accepted, please check your email',
      status: 202,
    };
    throw error;
  }

  return response.json();
}

/**
 * Auth API
 */
export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  googleAuth: async (data: GoogleAuthRequest): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCurrentUser: async (): Promise<User> => {
    return apiRequest<User>('/api/auth/me');
  },

  logout: async (): Promise<void> => {
    removeAuthToken();
  },

  uploadProfilePicture: async (file: File): Promise<{ message: string; profile_picture_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/auth/profile/upload-picture`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        detail: error.detail || 'Profile picture upload failed',
        status: response.status,
      };
    }

    return response.json();
  },

  deleteProfilePicture: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/auth/profile/delete-picture', {
      method: 'DELETE',
    });
  },
};

/**
 * Shops API
 */
export const shopsApi = {
  getAll: async (): Promise<Shop[]> => {
    const response = await apiRequest<{ shops: Shop[] }>('/api/shops/');
    return response.shops;
  },

  getEtsyConnectUrl: async (): Promise<{ authorization_url: string }> => {
    return apiRequest<{ authorization_url: string }>('/api/shops/etsy/connect');
  },

  connectEtsy: async (code: string, state: string): Promise<Shop> => {
    return apiRequest<Shop>('/api/shops/etsy/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });
  },

  disconnect: async (shopId: number): Promise<void> => {
    return apiRequest<void>(`/api/shops/${shopId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Products API
 */
export const productsApi = {
  getAll: async (page: number = 1, limit: number = 20, batchId?: string) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    if (batchId) {
      params.append('batch_id', batchId);
    }

    return apiRequest<{
      products: any[];
      total: number;
    }>(`/api/products/?${params.toString()}`);
  },

  getById: async (id: number) => {
    return apiRequest<any>(`/api/products/${id}`);
  },

  importSingle: async (data: any) => {
    return apiRequest<any>('/api/products/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  importBatch: async (products: any[]) => {
    return apiRequest<any>('/api/products/import/batch', {
      method: 'POST',
      body: JSON.stringify({ products }),
    });
  },

  importCsv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/products/import/csv`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      throw new Error('CSV import failed');
    }

    return response.json();
  },

  generateAI: async (productId: number, options?: { model?: string; style?: string; tone?: string }) => {
    return apiRequest<any>(`/api/products/${productId}/generate`, {
      method: 'POST',
      body: JSON.stringify({
        model: options?.model || 'gpt-4o-mini',
        style: options?.style || 'friendly',
        tone: options?.tone || 'helpful',
      }),
    });
  },

  delete: async (productId: number) => {
    return apiRequest<void>(`/api/products/${productId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Listings API
 */
export const listingsApi = {
  getAll: async (page: number = 1, limit: number = 20, status?: string) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    if (status) {
      params.append('status', status);
    }

    return apiRequest<{
      jobs: any[];
      total: number;
    }>(`/api/listings/?${params.toString()}`);
  },

  getById: async (id: number) => {
    return apiRequest<any>(`/api/listings/${id}`);
  },

  create: async (data: { product_id: number; shop_id: number }) => {
    return apiRequest<any>('/api/listings/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  retry: async (jobId: number) => {
    return apiRequest<any>(`/api/listings/${jobId}/retry`, {
      method: 'POST',
    });
  },

  cancel: async (jobId: number) => {
    return apiRequest<void>(`/api/listings/${jobId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Orders API
 */
export const ordersApi = {
  getAll: async (page: number = 1, limit: number = 20) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    return apiRequest<{
      orders: any[];
      total: number;
    }>(`/api/orders/?${params.toString()}`);
  },

  getById: async (id: number) => {
    return apiRequest<any>(`/api/orders/${id}`);
  },

  sync: async () => {
    return apiRequest<any>('/api/orders/sync', {
      method: 'POST',
    });
  },
};

/**
 * Schedules API
 */
export const schedulesApi = {
  getAll: async () => {
    return apiRequest<{ schedules: any[] }>('/api/schedules/');
  },

  getById: async (id: number) => {
    return apiRequest<any>(`/api/schedules/${id}`);
  },

  create: async (data: any) => {
    return apiRequest<any>('/api/schedules/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: any) => {
    return apiRequest<any>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiRequest<void>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  },

  toggle: async (id: number) => {
    return apiRequest<any>(`/api/schedules/${id}/toggle`, {
      method: 'POST',
    });
  },
};

/**
 * Usage & Costs API
 */
export const usageApi = {
  getSummary: async () => {
    return apiRequest<any>('/api/usage/summary');
  },

  getHistory: async (page: number = 1, limit: number = 50) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    return apiRequest<{
      costs: any[];
      total: number;
    }>(`/api/usage/history?${params.toString()}`);
  },
};

/**
 * Team Management API
 */
export interface TeamMember {
  id: number;
  user_id: number;
  email: string;
  name: string;
  role: string;
  invitation_status: string;  // pending, accepted, rejected
  joined_at: string;
  last_login: string | null;
}

export interface InviteMemberRequest {
  email: string;
  name: string;
  role: string;
}

export interface UserPermissions {
  can_invite_members: boolean;
  can_manage_roles: boolean;
  can_remove_members: boolean;
  can_manage_settings: boolean;
  can_create_products: boolean;
  can_generate_ai: boolean;
  can_publish_listings: boolean;
  is_owner: boolean;
}

export const teamApi = {
  getMembers: async (): Promise<TeamMember[]> => {
    return apiRequest<TeamMember[]>('/api/team/members');
  },

  inviteMember: async (data: InviteMemberRequest): Promise<any> => {
    return apiRequest<any>('/api/team/members/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRole: async (userId: number, role: string): Promise<any> => {
    return apiRequest<any>(`/api/team/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  removeMember: async (userId: number): Promise<any> => {
    return apiRequest<any>(`/api/team/members/${userId}`, {
      method: 'DELETE',
    });
  },

  getMyRole: async (): Promise<{
    user_id: number;
    tenant_id: number;
    role: string;
    permissions: UserPermissions;
  }> => {
    return apiRequest('/api/team/me/role');
  },
};

/**
 * Onboarding API
 */
export const onboardingApi = {
  complete: async (shopName: string, description: string | null): Promise<any> => {
    return apiRequest('/api/onboarding/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop_name: shopName,
        description: description,
      }),
    });
  },

  skip: async (): Promise<any> => {
    return apiRequest('/api/onboarding/skip', {
      method: 'POST',
    });
  },
};
