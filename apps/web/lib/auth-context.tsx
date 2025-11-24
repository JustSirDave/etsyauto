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
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, tenantName: string) => Promise<void>;
  logout: () => Promise<void>;
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
      console.log('🔍 Loading user...');
      const currentUser = await authApi.getCurrentUser();
      console.log('✅ User loaded:', currentUser);
      setUser(currentUser);
    } catch (err) {
      // No valid token, user not logged in
      console.log('❌ Failed to load user:', err);
      removeAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authApi.login({ email, password });

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
      });

      // Redirect to dashboard
      router.push('/');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Login failed');
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
      });

      // Redirect to dashboard
      router.push('/');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Registration failed');
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

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
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
