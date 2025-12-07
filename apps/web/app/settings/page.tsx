'use client';

/**
 * Settings Page - Vuexy Style
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { shopsApi, teamApi, type Shop, type ApiError, type TeamMember } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Settings as SettingsIcon, Store, Link as LinkIcon, Unlink, CheckCircle, XCircle,
  AlertCircle, Loader2, Building2, Users, Bell, UserPlus, Trash2, Shield, Eye, Edit, Crown, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'connections' | 'team' | 'notifications';

function SettingsContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('connections');
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingEtsy, setConnectingEtsy] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'creator' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => { loadShops(); }, []);
  useEffect(() => { if (activeTab === 'team') loadTeamMembers(); }, [activeTab]);

  const loadShops = async () => {
    try { setIsLoading(true); setError(null); const data = await shopsApi.getAll(); setShops(Array.isArray(data) ? data : []); }
    catch (err) { setError((err as ApiError).detail || 'Failed to load shops'); setShops([]); }
    finally { setIsLoading(false); }
  };

  const handleConnectEtsy = async () => {
    try { setConnectingEtsy(true); setError(null); const { authorization_url } = await shopsApi.getEtsyConnectUrl(); window.location.href = authorization_url; }
    catch (err) { setError((err as ApiError).detail || 'Failed'); setConnectingEtsy(false); }
  };

  const handleDisconnectShop = async (shopId: number) => {
    if (!confirm('Disconnect this shop?')) return;
    try { await shopsApi.disconnect(shopId); await loadShops(); } catch (err) { setError((err as ApiError).detail || 'Failed'); }
  };

  const loadTeamMembers = async () => {
    try { setLoadingTeam(true); setError(null); const members = await teamApi.getMembers(); setTeamMembers(members); }
    catch (err) { setError((err as ApiError).detail || 'Failed'); } finally { setLoadingTeam(false); }
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email || !inviteForm.name) { setError('Fill all fields'); return; }
    try { setInviting(true); setError(null); await teamApi.inviteMember(inviteForm); setShowInviteModal(false); setInviteForm({ email: '', name: '', role: 'creator' }); await loadTeamMembers(); }
    catch (err) { setError((err as ApiError).detail || 'Failed'); } finally { setInviting(false); }
  };

  const handleRemoveMember = async (userId: number, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try { setError(null); await teamApi.removeMember(userId); await loadTeamMembers(); } catch (err) { setError((err as ApiError).detail || 'Failed'); }
  };

  const getRoleColor = (role: string) => ({ owner: 'text-[var(--warning)] bg-[var(--warning-bg)]', admin: 'text-[var(--primary)] bg-[var(--primary-bg)]', creator: 'text-[var(--info)] bg-[var(--info-bg)]', viewer: 'text-[var(--text-muted)] bg-[var(--background)]' }[role] || 'text-[var(--text-muted)] bg-[var(--background)]');
  const getRoleIcon = (role: string) => ({ owner: <Crown className="w-4 h-4" />, admin: <Shield className="w-4 h-4" />, creator: <Edit className="w-4 h-4" />, viewer: <Eye className="w-4 h-4" /> }[role] || <Users className="w-4 h-4" />);

  const canManageTeam = user?.role === 'owner' || user?.role === 'admin';
  const etsyShop = Array.isArray(shops) ? shops.find(s => s.status === 'connected') : null;
  const tabs = [{ id: 'connections' as TabType, label: 'Connections', icon: LinkIcon }, { id: 'team' as TabType, label: 'Team', icon: Users }, { id: 'notifications' as TabType, label: 'Notifications', icon: Bell }];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-[var(--primary)]/30">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
          <p className="text-[var(--text-muted)]">Manage your integrations and preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative', activeTab === tab.id ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}>
            <tab.icon className="w-4 h-4" />{tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />}
          </button>
        ))}
      </div>

      {error && <div className="bg-[var(--danger-bg)] border border-[var(--danger)]/30 rounded-xl p-4 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-[var(--danger)]" /><p className="text-[var(--danger)] text-sm">{error}</p></div>}

      {activeTab === 'connections' && (
        <div className="space-y-6">
          <DashboardCard>
            <div className="flex items-center gap-3 mb-4"><Building2 className="w-5 h-5 text-[var(--primary)]" /><h2 className="text-lg font-semibold text-[var(--text-primary)]">Organization</h2></div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-[var(--text-muted)]">Name</p><p className="text-[var(--text-primary)] font-medium">{user?.tenant_name}</p></div>
              <div><p className="text-sm text-[var(--text-muted)]">Your Role</p><p className="text-[var(--text-primary)] font-medium capitalize">{user?.role}</p></div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3"><Store className="w-5 h-5 text-[var(--warning)]" /><h2 className="text-lg font-semibold text-[var(--text-primary)]">Etsy Shop</h2></div>
              {etsyShop ? <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--success-bg)] text-[var(--success)] rounded-full text-sm"><CheckCircle className="w-4 h-4" />Connected</div> : <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] text-[var(--text-muted)] rounded-full text-sm"><XCircle className="w-4 h-4" />Not Connected</div>}
            </div>
            {isLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
            : etsyShop ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div><p className="text-sm text-[var(--text-muted)]">Shop Name</p><p className="text-[var(--text-primary)] font-medium">{etsyShop.display_name}</p></div>
                  <div><p className="text-sm text-[var(--text-muted)]">Shop ID</p><p className="text-[var(--text-primary)] font-mono text-sm">{etsyShop.etsy_shop_id}</p></div>
                  <div><p className="text-sm text-[var(--text-muted)]">Connected</p><p className="text-[var(--text-primary)] text-sm">{new Date(etsyShop.created_at).toLocaleDateString()}</p></div>
                </div>
                <button onClick={() => handleDisconnectShop(etsyShop.id)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--danger-bg)] text-[var(--danger)] rounded-lg hover:bg-[var(--danger)]/20"><Unlink className="w-4 h-4" />Disconnect</button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[var(--text-muted)] text-sm">Connect your Etsy shop to start automating.</p>
                <button onClick={handleConnectEtsy} disabled={connectingEtsy} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--warning)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  {connectingEtsy ? <><Loader2 className="w-4 h-4 animate-spin" />Connecting...</> : <><LinkIcon className="w-4 h-4" />Connect Etsy</>}
                </button>
              </div>
            )}
          </DashboardCard>

          <DashboardCard className="opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><Store className="w-5 h-5 text-[var(--success)]" /><h2 className="text-lg font-semibold text-[var(--text-primary)]">Printful</h2></div>
              <span className="px-3 py-1.5 bg-[var(--background)] text-[var(--text-muted)] rounded-full text-xs">Coming Soon</span>
            </div>
          </DashboardCard>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <DashboardCard>
            <div className="flex items-center justify-between mb-6">
              <div><h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Members</h2><p className="text-sm text-[var(--text-muted)] mt-1">Manage access</p></div>
              {canManageTeam && <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-white rounded-lg shadow-lg shadow-[var(--primary)]/25"><UserPlus className="w-4 h-4" />Invite</button>}
            </div>
            {loadingTeam ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div> : (
              <div className="space-y-3">
                {teamMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-semibold">{member.name.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2"><p className="text-[var(--text-primary)] font-medium">{member.name}</p>{member.user_id === user?.id && <span className="px-2 py-0.5 bg-[var(--primary-bg)] text-[var(--primary)] text-xs rounded">You</span>}</div>
                        <p className="text-sm text-[var(--text-muted)]">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', getRoleColor(member.role))}>{getRoleIcon(member.role)}<span className="text-sm font-medium capitalize">{member.role}</span></div>
                      {canManageTeam && member.user_id !== user?.id && <button onClick={() => handleRemoveMember(member.user_id, member.name)} className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Role Descriptions */}
          <DashboardCard>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Roles</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Understanding access levels and permissions</p>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0', getRoleColor('owner'))}>
                  {getRoleIcon('owner')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Owner</h3>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Full access to all features including billing, team management, and shop connections. Can delete the workspace. Only one owner per workspace.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0', getRoleColor('admin'))}>
                  {getRoleIcon('admin')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Admin</h3>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Can manage products, listings, and AI generation. Can invite and remove team members. Cannot access billing or delete the workspace.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0', getRoleColor('creator'))}>
                  {getRoleIcon('creator')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Creator</h3>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Can create and edit products, generate AI content, and manage listings. Cannot invite team members or modify workspace settings.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0', getRoleColor('viewer'))}>
                  {getRoleIcon('viewer')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Viewer</h3>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Read-only access to products, orders, and analytics. Cannot create, edit, or delete any content. Perfect for stakeholders who need visibility without editing permissions.
                  </p>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {activeTab === 'notifications' && <DashboardCard><div className="text-center py-12"><Bell className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" /><p className="text-[var(--text-muted)]">Coming soon.</p></div></DashboardCard>}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-[var(--text-primary)]">Invite Member</h2><button onClick={() => setShowInviteModal(false)} className="text-[var(--text-muted)]"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label><input type="text" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Role</label><select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"><option value="creator">Creator</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg">Cancel</button>
              <button onClick={handleInviteMember} disabled={inviting} className="flex-1 px-4 py-3 gradient-primary text-white rounded-lg disabled:opacity-50 shadow-lg shadow-[var(--primary)]/25">{inviting ? 'Inviting...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return <DashboardLayout><SettingsContent /></DashboardLayout>;
}
