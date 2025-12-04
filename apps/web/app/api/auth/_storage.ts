// Shared mock storage for demo purposes
// Note: In serverless, this resets on each cold start, but works for demo

export interface MockUser {
  id: number;
  email: string;
  name: string;
  tenant_id: number;
  tenant_name: string;
  role: string;
  email_verified: boolean;
  onboarding_completed: boolean;
  profile_picture_url?: string | null;
  tenant_description?: string | null;
}

export const mockUsers: MockUser[] = [];
export const mockTokens: Map<string, MockUser> = new Map();

