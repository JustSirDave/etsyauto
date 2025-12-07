'use client';

/**
 * Authentication Context Provider
 * Manages user authentication state across the application
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, setAuthToken, removeAuthToken, type User, type ApiError } from './api';

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string, tenantName: string) => Promise<void>;
  googleLogin: (googleToken: string, tenantName?: string) => Promise<void>;
  logout: () => Promise<void>;
  uploadProfilePicture: (file: File) => Promise<void>;
  deleteProfilePicture: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      // No valid token, user not logged in
      removeAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authApi.login({ email, password, remember_me: rememberMe });

      // Save token
      setAuthToken(response.access_token);

      // Set user
      setUser({
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        tenant_id: response.tenant.id,
        tenant_name: response.tenant.name,
        role: response.tenant.role,
        profile_picture_url: response.user.profile_picture_url,
        tenant_description: response.tenant.description,
        onboarding_completed: response.tenant.onboarding_completed,
      });

      // Redirect to dashboard
      router.push('/');
    } catch (err: any) {
      let detail = err?.detail || '';

      // Handle FastAPI validation errors (array format)
      if (Array.isArray(detail) && detail.length > 0) {
        detail = detail.map((error: any) => error.msg).join('\n');
      }

      setError(detail || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    tenantName: string
  ) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authApi.register({
        email,
        password,
        name,
        tenant_name: tenantName,
      });

      // Save token
      setAuthToken(response.access_token);

      // Set user
      setUser({
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        tenant_id: response.tenant.id,
        tenant_name: response.tenant.name,
        role: response.tenant.role,
        profile_picture_url: response.user.profile_picture_url,
        tenant_description: response.tenant.description,
        onboarding_completed: response.tenant.onboarding_completed,
      });

      // Post-registration onboarding (new users always see onboarding)
      router.push('/?welcome=true');
    } catch (err: any) {
      // Status 202 means account created successfully but needs email verification
      // Check both err.status and fall through to message check
      const status = err?.status;
      let detail = err?.detail || '';

      // Handle FastAPI validation errors (array format)
      if (Array.isArray(detail) && detail.length > 0) {
        // Extract error messages from validation errors
        detail = detail.map((error: any) => error.msg).join('\n');
      }

      // 202 status OR success message indicates account was created
      if (status === 202 || (typeof detail === 'string' && detail.toLowerCase().includes('account created'))) {
        // This is a success case - store success message and redirect to login
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('registration_success', detail || 'Account created! Please check your email to verify your account.');
        }
        router.push('/login?registered=true');
        return;
      }

      setError(detail || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (googleToken: string, tenantName?: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authApi.googleAuth({
        google_token: googleToken,
        tenant_name: tenantName,
      });

      // Save token
      setAuthToken(response.access_token);

      // Set user
      setUser({
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        tenant_id: response.tenant.id,
        tenant_name: response.tenant.name,
        role: response.tenant.role,
        profile_picture_url: response.user.profile_picture_url,
        tenant_description: response.tenant.description,
        onboarding_completed: response.tenant.onboarding_completed,
      });

      // Post-login onboarding for new users
      if (response.user.is_new_user) {
        // TODO: Show onboarding modal or redirect to onboarding flow
        // For now, redirect to dashboard with a welcome message
        router.push('/?welcome=true');
      } else {
        // Existing user - redirect to dashboard
        router.push('/');
      }
    } catch (err) {
      const apiError = err as ApiError;
      // Provide detailed error message from backend
      setError(apiError.detail || 'Google sign in failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      // Force logout anyway
      setUser(null);
      removeAuthToken();
      router.push('/login');
    }
  };

  const clearError = () => {
    setError(null);
  };

  const uploadProfilePicture = async (file: File) => {
    try {
      setError(null);
      const response = await authApi.uploadProfilePicture(file);

      // Update user with new profile picture URL
      if (user) {
        setUser({
          ...user,
          profile_picture_url: response.profile_picture_url,
        });
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to upload profile picture');
      throw err;
    }
  };

  const deleteProfilePicture = async () => {
    try {
      setError(null);
      await authApi.deleteProfilePicture();

      // Update user to remove profile picture URL
      if (user) {
        setUser({
          ...user,
          profile_picture_url: null,
        });
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to delete profile picture');
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    setUser,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    googleLogin,
    logout,
    uploadProfilePicture,
    deleteProfilePicture,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
