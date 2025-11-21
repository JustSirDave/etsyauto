'use client';

/**
 * Settings Page
 * Manage OAuth connections, team members, and preferences
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { shopsApi, type Shop, type ApiError } from '@/lib/api';
import {
  Settings as SettingsIcon,
  Store,
  Link as LinkIcon,
  Unlink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  Users,
  Bell,
} from 'lucide-react';

type TabType = 'connections' | 'team' | 'notifications';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('connections');
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingEtsy, setConnectingEtsy] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await shopsApi.getAll();
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to load shops');
      setShops([]); // Ensure shops is always an array
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectEtsy = async () => {
    try {
      setConnectingEtsy(true);
      setError(null);

      const { authorization_url } = await shopsApi.getEtsyConnectUrl();

      // Redirect to Etsy OAuth
      window.location.href = authorization_url;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to connect Etsy');
      setConnectingEtsy(false);
    }
  };

  const handleDisconnectShop = async (shopId: number) => {
    if (!confirm('Are you sure you want to disconnect this shop?')) {
      return;
    }

    try {
      await shopsApi.disconnect(shopId);
      await loadShops();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to disconnect shop');
    }
  };

  const etsyShop = Array.isArray(shops) ? shops.find((s) => s.status === 'connected') : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-dark-muted">
            Manage your integrations and preferences
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-border">
        <button
          onClick={() => setActiveTab('connections')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'connections'
              ? 'text-teal-400'
              : 'text-dark-muted hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Connections
          </div>
          {activeTab === 'connections' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'team'
              ? 'text-teal-400'
              : 'text-dark-muted hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team
          </div>
          {activeTab === 'team' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'notifications'
              ? 'text-teal-400'
              : 'text-dark-muted hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </div>
          {activeTab === 'notifications' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'connections' && (
        <div className="space-y-6">
          {/* Organization Info */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-5 h-5 text-teal-400" />
              <h2 className="text-lg font-semibold text-white">Organization</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-dark-muted">Name</p>
                <p className="text-white font-medium">{user?.tenant_name}</p>
              </div>
              <div>
                <p className="text-sm text-dark-muted">Your Role</p>
                <p className="text-white font-medium capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Etsy Connection */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold text-white">Etsy Shop</h2>
              </div>
              {etsyShop ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-500/10 text-slate-400 rounded-full text-sm">
                  <XCircle className="w-4 h-4" />
                  Not Connected
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
              </div>
            ) : etsyShop ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-dark-muted mb-1">Shop Name</p>
                  <p className="text-white font-medium">{etsyShop.display_name}</p>
                </div>
                <div>
                  <p className="text-sm text-dark-muted mb-1">Shop ID</p>
                  <p className="text-white font-mono text-sm">{etsyShop.etsy_shop_id}</p>
                </div>
                <div>
                  <p className="text-sm text-dark-muted mb-1">Connected</p>
                  <p className="text-white text-sm">
                    {new Date(etsyShop.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnectShop(etsyShop.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect Shop
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-dark-muted text-sm">
                  Connect your Etsy shop to start automating your listings. You'll be
                  redirected to Etsy to authorize access.
                </p>
                <button
                  onClick={handleConnectEtsy}
                  disabled={connectingEtsy}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectingEtsy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      Connect Etsy Shop
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Printful Connection (Coming Soon) */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6 opacity-60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-semibold text-white">Printful</h2>
              </div>
              <div className="px-3 py-1.5 bg-slate-500/10 text-slate-400 rounded-full text-xs">
                Coming Soon
              </div>
            </div>
            <p className="text-dark-muted text-sm">
              Connect your Printful account for automated order fulfillment.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-dark-card rounded-lg border border-dark-border p-6">
          <p className="text-dark-muted text-center py-8">
            Team management coming soon in Phase 1.
          </p>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-dark-card rounded-lg border border-dark-border p-6">
          <p className="text-dark-muted text-center py-8">
            Notification preferences coming soon in Phase 1.
          </p>
        </div>
      )}
    </div>
  );
}
