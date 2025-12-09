'use client';

/**
 * Accept Invitation Page
 * Allows users to accept team invitations via email link
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Mail, Lock } from 'lucide-react';

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationData, setInvitationData] = useState<any>(null);
  const [mode, setMode] = useState<'new' | 'existing'>('new'); // new user or existing user
  const [loginPassword, setLoginPassword] = useState(''); // for existing users

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
    }
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    // Validate based on mode
    if (mode === 'new') {
      // New user - validate password fields
      if (!password || !confirmPassword) {
        setError('Please enter and confirm your password');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    } else {
      // Existing user - validate login password
      if (!loginPassword) {
        setError('Please enter your password to continue');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL !== undefined 
        ? process.env.NEXT_PUBLIC_API_URL 
        : 'http://localhost:8080';
      
      const response = await fetch(`${API_BASE_URL}/api/team/invitations/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          password: mode === 'new' ? password : null,
          existing_password: mode === 'existing' ? loginPassword : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to accept invitation');
      }

      setInvitationData(data);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?message=invitation_accepted');
      }, 3000);
    } catch (err: any) {
      console.error('Accept invitation error:', err);
      setError(err.message || 'Failed to accept invitation. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-dark-card rounded-lg border border-dark-border p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
            <p className="text-dark-muted mb-6">
              This invitation link is invalid or has expired.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-dark-card rounded-lg border border-dark-border p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Invitation Accepted!</h1>
            <p className="text-dark-muted mb-2">
              You have successfully joined <strong className="text-white">{invitationData?.tenant_name}</strong> as a{' '}
              <strong className="text-teal-400">{invitationData?.role}</strong>.
            </p>
            <p className="text-dark-muted mb-6">
              Redirecting to login...
            </p>
            <div className="flex items-center justify-center gap-2 text-teal-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Please wait</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-dark-card rounded-lg border border-dark-border p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Accept Team Invitation</h1>
            <p className="text-dark-muted">
              You've been invited to join a team. Complete the form below to accept.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Mode Selection */}
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === 'new'
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
                disabled={loading}
              >
                New to Platform
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === 'existing'
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
                disabled={loading}
              >
                I Have an Account
              </button>
            </div>
            
            {mode === 'new' ? (
              <p className="text-sm text-dark-muted">
                Set a password for your new account to complete the invitation.
              </p>
            ) : (
              <p className="text-sm text-dark-muted">
                Sign in with your existing password to accept the invitation.
              </p>
            )}
          </div>

          {/* Conditional Fields Based on Mode */}
          {mode === 'new' ? (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter password (min 8 characters)"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Confirm password"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-muted" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter your existing password"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-dark-muted mt-2">
                  Use the password from your existing account.
                </p>
              </div>
            </div>
          )}

          {/* Accept Button */}
          <button
            onClick={handleAcceptInvitation}
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Accepting Invitation...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Accept Invitation
              </>
            )}
          </button>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-dark-muted">
              Already have an account?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-teal-400 hover:text-teal-300 font-medium"
              >
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-dark-bg flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
