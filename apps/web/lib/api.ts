/**
 * API Client for Etsy Automation Platform
 * Handles all HTTP requests to the FastAPI backend
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL !== undefined ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:8080';

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

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `idem_${Math.random().toString(36).slice(2)}_${Date.now()}`;
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

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = generateIdempotencyKey();
  }

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

  getEtsyConnectUrl: async (shopName?: string): Promise<{ authorization_url: string }> => {
    const params = shopName ? `?shop_name=${encodeURIComponent(shopName)}` : '';
    return apiRequest<{ authorization_url: string }>(`/api/shops/etsy/connect${params}`);
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

  updateDisplayName: async (shopId: number, displayName: string): Promise<Shop> => {
    return apiRequest<Shop>(`/api/shops/${shopId}`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: displayName }),
    });
  },
};

/**
 * Products API
 */
export interface ProductVariant {
  sku?: string;
  option1_name?: string;
  option1_value?: string;
  option2_name?: string;
  option2_value?: string;
  price?: number;
  quantity?: number;
}

export interface Product {
  id: number;
  shop_id?: number | null;
  etsy_listing_id?: string | null;
  title_raw: string;
  description_raw: string;
  tags_raw: string[];
  images: string[];
  price: number | null;
  source: string;
  batch_id: string | null;
  created_at: string;
  variants?: ProductVariant[];
}

export const productsApi = {
  getAll: async (page: number = 1, limit: number = 20, batchId?: string, options: ShopQueryOptions = {}) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    if (batchId) {
      params.append('batch_id', batchId);
    }
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }

    return apiRequest<{
      products: Product[];
      total: number;
    }>(`/api/products/?${params.toString()}`);
  },

  getById: async (id: number) => {
    return apiRequest<Product>(`/api/products/${id}`);
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

  update: async (productId: number, data: any) => {
    return apiRequest<any>(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  syncFromEtsy: async (shopId: number): Promise<{ message: string; shop_id: number }> => {
    return apiRequest<{ message: string; shop_id: number }>(`/api/products/sync/etsy?shop_id=${shopId}`, {
      method: 'POST',
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
  getAll: async (page: number = 1, limit: number = 20, status?: string, options: ShopQueryOptions = {}) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    if (status) {
      params.append('status', status);
    }
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
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
export interface Order {
  id: number;
  order_id: string;
  etsy_receipt_id: string | null;
  shop_id: number;
  supplier_user_id?: number | null;
  supplier_name?: string | null;
  supplier_email?: string | null;
  buyer_name: string;
  buyer_email: string;
  total_price: number | null;
  currency: string;
  status: string;
  lifecycle_status?: string;
  payment_status: string;
  fulfillment_status?: string;
  item_image?: string | null;
  item_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetail extends Order {
  shipping_address: any;
  items: any[];
  synced_at: string | null;
  shipments?: any[];
}

export interface OrderStats {
  order_status: {
    processing: number;
    in_transit: number;
    completed: number;
    cancelled: number;
    refunded: number;
  };
  payment_status: {
    paid: number;
    unpaid: number;
  };
  total: number;
}

export interface OrderQueryOptions {
  shopId?: number | null;
}

export interface OrderSyncOptions {
  forceFullSync?: boolean;
}

export interface ShopQueryOptions {
  shopId?: number | null;
}

export const ordersApi = {
  getStats: async (options: OrderQueryOptions = {}): Promise<OrderStats> => {
    const params = new URLSearchParams();
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }
    const url = params.toString() ? `/api/orders/stats?${params.toString()}` : '/api/orders/stats';
    return apiRequest<OrderStats>(url);
  },

  getAll: async (
    page: number = 1,
    limit: number = 20,
    status?: string,
    paymentStatus?: string,
    options: OrderQueryOptions = {}
  ) => {
    const params = new URLSearchParams({
      skip: String((page - 1) * limit),
      limit: String(limit),
    });

    if (status) {
      params.append('status', status);
    }
    if (paymentStatus) {
      params.append('payment_status', paymentStatus);
    }
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }

    return apiRequest<{
      orders: Order[];
      total: number;
      skip: number;
      limit: number;
    }>(`/api/orders/?${params.toString()}`);
  },

  getById: async (id: number): Promise<OrderDetail> => {
    return apiRequest<OrderDetail>(`/api/orders/${id}`);
  },

  assignSupplier: async (orderId: number, supplierUserId: number): Promise<any> => {
    return apiRequest(`/api/orders/${orderId}/assign-supplier`, {
      method: 'POST',
      body: JSON.stringify({ supplier_user_id: supplierUserId }),
    });
  },

  fulfill: async (
    orderId: number,
    payload: {
      tracking_code: string;
      carrier_name?: string;
      ship_date?: string;
      note?: string;
      send_bcc?: boolean;
    }
  ): Promise<any> => {
    return apiRequest(`/api/orders/${orderId}/fulfill`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  recordTracking: async (
    orderId: number,
    payload: {
      tracking_code: string;
      carrier_name?: string;
      ship_date?: string;
      note?: string;
    }
  ): Promise<any> => {
    return apiRequest(`/api/orders/${orderId}/tracking`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sync: async (options: OrderSyncOptions & OrderQueryOptions = {}) => {
    const params = new URLSearchParams();
    if (options.forceFullSync) {
      params.append('force_full_sync', 'true');
    }
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }

    const url = params.toString() ? `/api/orders/sync?${params.toString()}` : '/api/orders/sync';
    return apiRequest<any>(url, {
      method: 'POST',
    });
  },
  markViewed: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/orders/mark-viewed', {
      method: 'POST',
    });
  },
};

/**
 * Schedules API
 */
export interface Schedule {
  id: number;
  name: string;
  description: string | null;
  type: 'sync' | 'generate' | 'backup' | 'report';
  cron_expr: string;
  daily_quota: number;
  status: 'active' | 'paused' | 'error';
  shop_id: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  execution_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleStats {
  total: number;
  active: number;
  paused: number;
  executions_today: number;
}

export interface ScheduleCreate {
  name: string;
  description?: string;
  type: 'sync' | 'generate' | 'backup' | 'report';
  cron_expr: string;
  daily_quota?: number;
  shop_id?: number;
}

export interface ScheduleUpdate {
  name?: string;
  description?: string;
  type?: 'sync' | 'generate' | 'backup' | 'report';
  cron_expr?: string;
  daily_quota?: number;
  shop_id?: number;
  status?: 'active' | 'paused' | 'error';
}

export const schedulesApi = {
  getAll: async (status?: string, options: ShopQueryOptions = {}): Promise<{ schedules: Schedule[]; stats: ScheduleStats }> => {
    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<{ schedules: Schedule[]; stats: ScheduleStats }>(`/api/schedules/${query}`);
  },

  getById: async (id: number): Promise<Schedule> => {
    return apiRequest<Schedule>(`/api/schedules/${id}`);
  },

  create: async (data: ScheduleCreate): Promise<{ id: number; name: string; message: string }> => {
    return apiRequest<{ id: number; name: string; message: string }>('/api/schedules/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: ScheduleUpdate): Promise<{ id: number; message: string }> => {
    return apiRequest<{ id: number; message: string }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  },

  toggle: async (id: number): Promise<{ id: number; status: string; message: string }> => {
    return apiRequest<{ id: number; status: string; message: string }>(`/api/schedules/${id}/toggle`, {
      method: 'POST',
    });
  },

  pauseAll: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/schedules/pause-all', {
      method: 'POST',
    });
  },

  resumeAll: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/schedules/resume-all', {
      method: 'POST',
    });
  },

  runAllSyncs: async (): Promise<{ message: string; triggered_count: number }> => {
    return apiRequest<{ message: string; triggered_count: number }>('/api/schedules/run-all-syncs', {
      method: 'POST',
    });
  },

  // Quota Management
  getQuota: async (scheduleId: number): Promise<any> => {
    return apiRequest(`/api/schedules/${scheduleId}/quota`);
  },

  updateQuota: async (scheduleId: number, dailyQuota: number, weeklyQuota: number | null): Promise<any> => {
    return apiRequest(`/api/schedules/${scheduleId}/quota`, {
      method: 'PUT',
      body: JSON.stringify({ daily_quota: dailyQuota, weekly_quota: weeklyQuota }),
    });
  },

  resetQuota: async (scheduleId: number, resetDaily: boolean = true, resetWeekly: boolean = false): Promise<any> => {
    return apiRequest(`/api/schedules/${scheduleId}/quota/reset`, {
      method: 'POST',
      body: JSON.stringify({ reset_daily: resetDaily, reset_weekly: resetWeekly }),
    });
  },

  getQuotaSummary: async (): Promise<any> => {
    return apiRequest('/api/schedules/quota/summary');
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
  allowed_shop_ids?: number[];
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
  can_assign_orders?: boolean;
  can_update_fulfillment?: boolean;
  is_owner: boolean;
}

export interface SupplierProfile {
  id: number;
  tenant_id: number;
  user_id: number;
  shop_id?: number | null;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
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

  updateShopAccess: async (userId: number, shopIds: number[]): Promise<any> => {
    return apiRequest<any>(`/api/team/members/${userId}/shops`, {
      method: 'PATCH',
      body: JSON.stringify({ shop_ids: shopIds }),
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

export const suppliersApi = {
  getMyProfile: async (): Promise<SupplierProfile | null> => {
    return apiRequest<SupplierProfile | null>('/api/suppliers/me');
  },
  updateMyProfile: async (payload: Partial<SupplierProfile>) => {
    return apiRequest<SupplierProfile>('/api/suppliers/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  list: async (): Promise<SupplierProfile[]> => {
    return apiRequest<SupplierProfile[]>('/api/suppliers');
  },
};

/**
 * Onboarding API
 */
export const onboardingApi = {
  getStatus: async (): Promise<{ needs_onboarding: boolean; [key: string]: any }> => {
    return apiRequest('/api/onboarding/status');
  },

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

/**
 * Dashboard API
 */
export interface DashboardStats {
  total_products: number;
  total_customers: number;
  total_orders: number;
  active_listings: number;
  new_orders_unread: number;
  changes: {
    products: number;
    customers: number;
    orders: number;
    listings: number;
  };
}

export interface DashboardOrder {
  id: number;
  order_id: string;
  buyer_name: string;
  customer: string;
  customer_email: string;
  item_title?: string;
  date: string;
  amount: string;
  total_price?: number | null;
  status: string;
  payment_status: string;
  lifecycle_status?: string;
}

export const dashboardApi = {
  getStats: async (options: ShopQueryOptions = {}): Promise<DashboardStats> => {
    const params = new URLSearchParams();
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<DashboardStats>(`/api/dashboard/stats${query}`);
  },

  getRecentOrders: async (limit: number = 5, options: ShopQueryOptions = {}): Promise<{ orders: DashboardOrder[]; total: number }> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (options.shopId) {
      params.append('shop_id', String(options.shopId));
    }
    return apiRequest<{ orders: DashboardOrder[]; total: number }>(`/api/dashboard/recent-orders?${params.toString()}`);
  },
};

/**
 * Notifications API
 */
export interface Notification {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error' | 'order' | 'listing' | 'system';
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

export const notificationsApi = {
  getAll: async (skip: number = 0, limit: number = 50, unreadOnly: boolean = false): Promise<Notification[]> => {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
      unread_only: String(unreadOnly),
    });
    return apiRequest<Notification[]>(`/api/notifications/?${params.toString()}`);
  },

  getUnreadCount: async (type?: string): Promise<{ count: number }> => {
    const params = new URLSearchParams();
    if (type) {
      params.append('type', type);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<{ count: number }>(`/api/notifications/unread-count${query}`);
  },

  markAsRead: async (notificationId: number): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  markAllAsRead: async (): Promise<{ message: string; count: number }> => {
    return apiRequest<{ message: string; count: number }>('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  },
  markReadByType: async (type: string): Promise<{ message: string; count: number }> => {
    const query = `?type=${encodeURIComponent(type)}`;
    return apiRequest<{ message: string; count: number }>(`/api/notifications/mark-read-by-type${query}`, {
      method: 'POST',
    });
  },

  delete: async (notificationId: number): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  deleteAll: async (): Promise<{ message: string; count: number }> => {
    return apiRequest<{ message: string; count: number }>('/api/notifications/', {
      method: 'DELETE',
    });
  },

  create: async (notification: {
    type: Notification['type'];
    title: string;
    message: string;
    action_url?: string;
    action_label?: string;
  }): Promise<Notification> => {
    return apiRequest<Notification>('/api/notifications/create', {
      method: 'POST',
      body: JSON.stringify(notification),
    });
  },
};

/**
 * AI Generation API
 */
export interface AIStats {
  total_generations: number;
  success_rate: number;
  avg_response_time_ms: number;
  growth_percentage: number;
  this_month_count: number;
  last_month_count: number;
}

export interface AIGeneration {
  id: number;
  product_id: number;
  type: 'title' | 'description' | 'tags';
  title: string;
  timestamp: string;
  status: 'completed' | 'failed';
  cost_tokens: number;
  cost_usd_cents: number;
}

export interface AIGenerationResult {
  ai_generation_id: number;
  title: string;
  description: string;
  tags: string[];
  policy_flags: any;
  cost: {
    tokens: number;
    usd_cents: number;
  };
}

export const aiApi = {
  getStats: async (): Promise<AIStats> => {
    return apiRequest<AIStats>('/api/ai/stats');
  },

  getRecentGenerations: async (limit: number = 10): Promise<{ generations: AIGeneration[]; total: number }> => {
    const params = new URLSearchParams({ limit: String(limit) });
    return apiRequest<{ generations: AIGeneration[]; total: number }>(`/api/ai/recent?${params.toString()}`);
  },

  generateContent: async (productId: number, options?: { model?: string; style?: string; tone?: string }): Promise<AIGenerationResult> => {
    return apiRequest<AIGenerationResult>(`/api/products/${productId}/generate`, {
      method: 'POST',
      body: JSON.stringify({
        model: options?.model || 'gpt-4o-mini',
        style: options?.style || 'friendly',
        tone: options?.tone || 'helpful',
      }),
    });
  },

  // Helper for form data uploads (not used in current implementation)
  postForm: async (endpoint: string, formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw { response: { data: errorData } };
    }

    return await response.json();
  },
};

/**
 * Analytics API (Owner/Admin/Viewer only)
 */
export interface OverviewAnalytics {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  orders_7d: number;
  orders_30d: number;
  revenue_7d: number;
  revenue_30d: number;
  orders_7d_trend: number;
  orders_30d_trend: number;
  revenue_7d_trend: number;
  revenue_30d_trend: number;
  computed_at: string;
}

export interface OrderAnalytics {
  status_breakdown: {
    processing: number;
    in_transit: number;
    completed: number;
    cancelled: number;
    refunded: number;
  };
  payment_breakdown: {
    paid: number;
    unpaid: number;
  };
  computed_at: string;
}

export interface ProductAnalytics {
  total_products: number;
  published_products: number;
  draft_products: number;
  listing_jobs: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
  computed_at: string;
}

export interface FulfillmentAnalytics {
  state_breakdown: {
    processing: number;
    shipped: number;
    in_transit: number;
    delivered: number;
    delayed: number;
    cancelled: number;
  };
  source_breakdown: {
    manual: number;
    etsy_sync: number;
    auto: number;
  };
  avg_fulfillment_time_hours: number;
  supplier_performance: {
    [supplierId: string]: {
      shipment_count: number;
    };
  };
  computed_at: string;
}

export const analyticsApi = {
  /**
   * Get overview analytics (owner/admin/viewer only)
   * @param shopId Optional shop filter
   * @param forceRefresh Force cache refresh
   */
  getOverview: async (shopId?: number, forceRefresh?: boolean): Promise<OverviewAnalytics> => {
    const params = new URLSearchParams();
    if (shopId) params.append('shop_id', String(shopId));
    if (forceRefresh) params.append('force_refresh', 'true');
    
    return apiRequest<OverviewAnalytics>(`/api/analytics/overview?${params.toString()}`);
  },

  /**
   * Get order analytics (owner/admin/viewer only)
   * @param shopId Optional shop filter
   * @param forceRefresh Force cache refresh
   */
  getOrders: async (shopId?: number, forceRefresh?: boolean): Promise<OrderAnalytics> => {
    const params = new URLSearchParams();
    if (shopId) params.append('shop_id', String(shopId));
    if (forceRefresh) params.append('force_refresh', 'true');
    
    return apiRequest<OrderAnalytics>(`/api/analytics/orders?${params.toString()}`);
  },

  /**
   * Get product analytics (owner/admin/viewer only)
   * @param shopId Optional shop filter
   * @param forceRefresh Force cache refresh
   */
  getProducts: async (shopId?: number, forceRefresh?: boolean): Promise<ProductAnalytics> => {
    const params = new URLSearchParams();
    if (shopId) params.append('shop_id', String(shopId));
    if (forceRefresh) params.append('force_refresh', 'true');
    
    return apiRequest<ProductAnalytics>(`/api/analytics/products?${params.toString()}`);
  },

  /**
   * Get fulfillment analytics (owner/admin/viewer only)
   * Note: supplier_performance field should only be displayed to owners
   * @param shopId Optional shop filter
   * @param forceRefresh Force cache refresh
   */
  getFulfillment: async (shopId?: number, forceRefresh?: boolean): Promise<FulfillmentAnalytics> => {
    const params = new URLSearchParams();
    if (shopId) params.append('shop_id', String(shopId));
    if (forceRefresh) params.append('force_refresh', 'true');
    
    return apiRequest<FulfillmentAnalytics>(`/api/analytics/fulfillment?${params.toString()}`);
  },

  /**
   * Invalidate analytics cache (owner/admin/viewer only)
   * @param shopId Optional shop filter
   */
  invalidateCache: async (shopId?: number): Promise<{ message: string }> => {
    const params = new URLSearchParams();
    if (shopId) params.append('shop_id', String(shopId));
    
    return apiRequest<{ message: string }>(`/api/analytics/invalidate?${params.toString()}`, {
      method: 'POST',
    });
  },
};
