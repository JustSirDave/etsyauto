'use client';

/**
 * Settings Page
 * Manage OAuth connections, team members, and preferences
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { shopsApi, teamApi, type Shop, type ApiError, type TeamMember, type InviteMemberRequest } from '@/lib/api';
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
  UserPlus,
  MoreVertical,
  Trash2,
  Shield,
  Eye,
  Edit,
  Crown,
} from 'lucide-react';

type TabType = 'connections' | 'team' | 'notifications';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('connections');
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingEtsy, setConnectingEtsy] = useState(false);

  // Team management state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'creator' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamMembers();
    }
  }, [activeTab]);

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

  // Team Management Functions
  const loadTeamMembers = async () => {
    try {
      setLoadingTeam(true);
      setError(null);
      const members = await teamApi.getMembers();
      setTeamMembers(members);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to load team members');
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email || !inviteForm.name || !inviteForm.role) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setInviting(true);
      setError(null);
      await teamApi.inviteMember(inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'creator' });
      await loadTeamMembers();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      setError(null);
      await teamApi.updateRole(userId, newRole);
      await loadTeamMembers();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: number, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the organization?`)) {
      return;
    }

    try {
      setError(null);
      await teamApi.removeMember(userId);
      await loadTeamMembers();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.detail || 'Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'creator':
        return <Edit className="w-4 h-4" />;
      case 'viewer':
        return <Eye className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'admin':
        return 'text-purple-400 bg-purple-400/10';
      case 'creator':
        return 'text-blue-400 bg-blue-400/10';
      case 'viewer':
        return 'text-slate-400 bg-slate-400/10';
      default:
        return 'text-slate-400 bg-slate-400/10';
    }
  };

  const canManageTeam = user?.role === 'owner' || user?.role === 'admin';

  const etsyShop = Array.isArray(shops) ? shops.find((s) => s.status === 'connected') : null;

  return (
    <div className="space-y-6">
      {/* Sticky Header + Tabs */}
      <div className="sticky top-0 z-10 bg-[#0a0a0b] pb-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pt-6">
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
        <div className="space-y-6">
          {/* Team Header */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Team Members</h2>
                <p className="text-sm text-dark-muted mt-1">
                  Manage who has access to your organization
                </p>
              </div>
              {canManageTeam && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </button>
              )}
            </div>

            {/* Team Members List */}
            {loadingTeam ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{member.name}</p>
                          {member.user_id === user?.id && (
                            <span className="px-2 py-0.5 bg-teal-500/20 text-teal-400 text-xs rounded">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">{member.email}</p>
                        {member.last_login && (
                          <p className="text-xs text-slate-500 mt-1">
                            Last login: {new Date(member.last_login).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Role Badge */}
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${getRoleColor(member.role)}`}>
                        {getRoleIcon(member.role)}
                        <span className="text-sm font-medium capitalize">{member.role}</span>
                      </div>

                      {/* Actions Dropdown (only for owners/admins, not for self) */}
                      {canManageTeam && member.user_id !== user?.id && (
                        <div className="relative group">
                          <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                          </button>

                          {/* Dropdown Menu */}
                          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <div className="py-1">
                              <button
                                onClick={() => handleChangeRole(member.user_id, 'owner')}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Crown className="w-4 h-4" />
                                Make Owner
                              </button>
                              <button
                                onClick={() => handleChangeRole(member.user_id, 'admin')}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Shield className="w-4 h-4" />
                                Make Admin
                              </button>
                              <button
                                onClick={() => handleChangeRole(member.user_id, 'creator')}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Make Creator
                              </button>
                              <button
                                onClick={() => handleChangeRole(member.user_id, 'viewer')}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Make Viewer
                              </button>
                              <div className="border-t border-slate-700 my-1"></div>
                              <button
                                onClick={() => handleRemoveMember(member.user_id, member.name)}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role Descriptions */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <h3 className="text-white font-semibold mb-4">Role Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-medium">Owner</span>
                </div>
                <p className="text-sm text-slate-400">
                  Full access to all features, team management, and billing
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span className="text-white font-medium">Admin</span>
                </div>
                <p className="text-sm text-slate-400">
                  Manage settings, team members, and all content
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Edit className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium">Creator</span>
                </div>
                <p className="text-sm text-slate-400">
                  Create products, generate AI content, publish listings
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-medium">Viewer</span>
                </div>
                <p className="text-sm text-slate-400">
                  Read-only access to dashboard and reports
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Invite Team Member</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="teammate@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="creator">Creator</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                  {user?.role === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteForm({ email: '', name: '', role: 'creator' });
                  setError(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteMember}
                disabled={inviting}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {inviting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Inviting...
                  </div>
                ) : (
                  'Send Invite'
                )}
              </button>
            </div>
          </div>
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
