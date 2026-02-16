'use client';

/**
 * Settings Page - Vuexy Style
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { shopsApi, teamApi, suppliersApi, type Shop, type ApiError, type TeamMember, type SupplierProfile } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { NotificationModal } from '@/components/modals/NotificationModal';
import {
  Settings as SettingsIcon, Store, Link as LinkIcon, Unlink, CheckCircle, CheckCircle2, XCircle,
  AlertCircle, Loader2, Building2, Users, Bell, UserPlus, Trash2, Shield, Eye, Edit, Crown, X, Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'connections' | 'shops' | 'team' | 'notifications' | 'supplier_profile';

function SettingsContent() {
  const { user } = useAuth();
  const { refreshShops } = useShop();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'connections');
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingEtsy, setConnectingEtsy] = useState(false);
  const [shopNameInput, setShopNameInput] = useState('');
  const [editingShopId, setEditingShopId] = useState<number | null>(null);
  const [shopNameDraft, setShopNameDraft] = useState('');
  const [savingShopName, setSavingShopName] = useState(false);
  const [shopAccessMember, setShopAccessMember] = useState<TeamMember | null>(null);
  const [shopAccessSelections, setShopAccessSelections] = useState<number[]>([]);
  const [savingShopAccess, setSavingShopAccess] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [supplierProfile, setSupplierProfile] = useState<SupplierProfile | null>(null);
  const [loadingSupplierProfile, setLoadingSupplierProfile] = useState(false);
  const [savingSupplierProfile, setSavingSupplierProfile] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'admin' });
  const [inviting, setInviting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [shopToDisconnect, setShopToDisconnect] = useState<{ id: number; name: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDeleteShopModal, setShowDeleteShopModal] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<{ id: number; name: string } | null>(null);
  const [deletingShop, setDeletingShop] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ show: false, type: 'success', title: '', message: '' });

  useEffect(() => { loadShops(); }, []);
  useEffect(() => { if (activeTab === 'team') loadTeamMembers(); }, [activeTab]);
  useEffect(() => { if (user?.role === 'supplier') loadSupplierProfile(); }, [user?.role]);
  
  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const loadShops = async () => {
    try { setIsLoading(true); setError(null); const data = await shopsApi.getAll(); setShops(Array.isArray(data) ? data : []); }
    catch (err) { setError((err as ApiError).detail || 'Failed to load shops'); setShops([]); }
    finally { setIsLoading(false); }
  };

  const [linkCopied, setLinkCopied] = useState(false);
  const [showConnectLinkModal, setShowConnectLinkModal] = useState(false);
  const [generatedConnectUrl, setGeneratedConnectUrl] = useState('');
  const [connectLinkCopied, setConnectLinkCopied] = useState(false);

  const handleConnectEtsy = async () => {
    try {
      setConnectingEtsy(true);
      setError(null);
      const { connect_url } = await shopsApi.createConnectLink(shopNameInput || undefined);
      setGeneratedConnectUrl(connect_url);
      setShowConnectLinkModal(true);
      setConnectLinkCopied(false);
    } catch (err) {
      setError((err as ApiError).detail || 'Failed to generate connection link');
    } finally {
      setConnectingEtsy(false);
    }
  };

  const handleCopyConnectLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedConnectUrl);
      setConnectLinkCopied(true);
      setTimeout(() => setConnectLinkCopied(false), 4000);
    } catch {
      setError('Failed to copy link to clipboard');
    }
  };

  const handleStartRename = (shopId: number, currentName: string) => {
    setShopNameDraft(currentName || '');
    setEditingShopId(shopId);
  };

  const handleCancelRename = () => {
    setEditingShopId(null);
    setShopNameDraft('');
  };

  const handleSaveRename = async (shopId: number) => {
    if (!shopNameDraft.trim()) {
      setError('Shop name is required');
      return;
    }
    try {
      setSavingShopName(true);
      setError(null);
      await shopsApi.updateDisplayName(shopId, shopNameDraft.trim());
      setEditingShopId(null);
      await loadShops();
    } catch (err) {
      setError((err as ApiError).detail || 'Failed to update shop name');
    } finally {
      setSavingShopName(false);
    }
  };

  const openShopAccessModal = (member: TeamMember) => {
    setShopAccessMember(member);
    setShopAccessSelections(member.allowed_shop_ids || []);
  };

  const closeShopAccessModal = () => {
    setShopAccessMember(null);
    setShopAccessSelections([]);
  };

  const saveShopAccess = async () => {
    if (!shopAccessMember) return;
    try {
      setSavingShopAccess(true);
      setError(null);
      await teamApi.updateShopAccess(shopAccessMember.user_id, shopAccessSelections);
      await loadTeamMembers();
      closeShopAccessModal();
    } catch (err: any) {
      setError((err as ApiError).detail || 'Failed to update shop access');
    } finally {
      setSavingShopAccess(false);
    }
  };

  const handleDisconnectShop = async (shopId: number, shopName: string) => {
    setShopToDisconnect({ id: shopId, name: shopName });
    setShowDisconnectModal(true);
  };

  const handleDeleteShop = (shopId: number, shopName: string) => {
    setShopToDelete({ id: shopId, name: shopName });
    setDeleteConfirmText('');
    setShowDeleteShopModal(true);
  };

  const confirmDeleteShop = async () => {
    if (!shopToDelete) return;
    try {
      setDeletingShop(true);
      await shopsApi.deletePermanently(shopToDelete.id);
      setShowDeleteShopModal(false);
      setNotification({
        show: true,
        type: 'success',
        title: 'Shop Deleted',
        message: `${shopToDelete.name} and all associated data have been permanently deleted.`
      });
      setShopToDelete(null);
      setDeleteConfirmText('');
      await loadShops();
      refreshShops();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Deletion Failed',
        message: (err as ApiError).detail || 'Failed to delete shop. Please try again.'
      });
    } finally {
      setDeletingShop(false);
    }
  };

  const confirmDisconnectShop = async () => {
    if (!shopToDisconnect) return;
    try {
      setDisconnecting(true);
      await shopsApi.disconnect(shopToDisconnect.id);
      setShowDisconnectModal(false);
      setNotification({
        show: true,
        type: 'success',
        title: 'Shop Disconnected',
        message: `${shopToDisconnect.name} has been disconnected successfully.`
      });
      setShopToDisconnect(null);
      await loadShops();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Disconnection Failed',
        message: (err as ApiError).detail || 'Failed to disconnect shop. Please try again.'
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const loadTeamMembers = async () => {
    try { setLoadingTeam(true); setError(null); const members = await teamApi.getMembers(); setTeamMembers(members); }
    catch (err) { setError((err as ApiError).detail || 'Failed'); } finally { setLoadingTeam(false); }
  };

  const loadSupplierProfile = async () => {
    try {
      setLoadingSupplierProfile(true);
      setError(null);
      const profile = await suppliersApi.getMyProfile();
      setSupplierProfile(profile);
    } catch (err) {
      setError((err as ApiError).detail || 'Failed to load supplier profile');
    } finally {
      setLoadingSupplierProfile(false);
    }
  };

  const handleSupplierProfileChange = (field: keyof SupplierProfile, value: string) => {
    setSupplierProfile((prev) => ({
      ...(prev || {
        id: 0,
        tenant_id: 0,
        user_id: 0,
      }),
      [field]: value,
    }));
  };

  const saveSupplierProfile = async () => {
    try {
      setSavingSupplierProfile(true);
      setError(null);
      const payload: Partial<SupplierProfile> = {
        shop_id: supplierProfile?.shop_id ?? null,
        company_name: supplierProfile?.company_name || null,
        contact_name: supplierProfile?.contact_name || null,
        email: supplierProfile?.email || null,
        phone: supplierProfile?.phone || null,
        address_line1: supplierProfile?.address_line1 || null,
        address_line2: supplierProfile?.address_line2 || null,
        city: supplierProfile?.city || null,
        state: supplierProfile?.state || null,
        postal_code: supplierProfile?.postal_code || null,
        country: supplierProfile?.country || null,
        notes: supplierProfile?.notes || null,
      };
      const updated = await suppliersApi.updateMyProfile(payload);
      setSupplierProfile(updated);
      setNotification({
        show: true,
        type: 'success',
        title: 'Profile Saved',
        message: 'Your supplier profile has been updated.',
      });
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Save Failed',
        message: (err as ApiError).detail || 'Failed to save supplier profile.',
      });
    } finally {
      setSavingSupplierProfile(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all fields before sending the invitation.'
      });
      return;
    }
    try {
      setInviting(true);
      setError(null);
      await teamApi.inviteMember(inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'admin' });
      setNotification({
        show: true,
        type: 'success',
        title: 'Invitation Sent!',
        message: `An invitation has been sent to ${inviteForm.email}. They will receive an email with instructions to join your team.`
      });
      await loadTeamMembers();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Invitation Failed',
        message: (err as ApiError).detail || 'Failed to send invitation. Please try again.'
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: number, name: string) => {
    setMemberToDelete({ id: userId, name });
    setShowDeleteModal(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToDelete) return;
    try {
      setDeleting(true);
      setError(null);
      await teamApi.removeMember(memberToDelete.id);
      setShowDeleteModal(false);
      setNotification({
        show: true,
        type: 'success',
        title: 'Member Removed',
        message: `${memberToDelete.name} has been removed from your team.`
      });
      setMemberToDelete(null);
      await loadTeamMembers();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: 'Removal Failed',
        message: (err as ApiError).detail || 'Failed to remove team member. Please try again.'
      });
    } finally {
      setDeleting(false);
    }
  };

  const getRoleColor = (role: string) => ({
    owner: 'text-[var(--warning)] bg-[var(--warning-bg)]',
    admin: 'text-[var(--primary)] bg-[var(--primary-bg)]',
    viewer: 'text-[var(--text-muted)] bg-[var(--background)]',
    supplier: 'text-[var(--success)] bg-[var(--success-bg)]',
  }[role] || 'text-[var(--text-muted)] bg-[var(--background)]');
  const getRoleIcon = (role: string) => ({
    owner: <Crown className="w-4 h-4" />,
    admin: <Shield className="w-4 h-4" />,
    viewer: <Eye className="w-4 h-4" />,
    supplier: <Truck className="w-4 h-4" />,
  }[role] || <Users className="w-4 h-4" />);
  const getShopAccessLabel = (member: TeamMember) => {
    if (member.role === 'owner' || member.role === 'admin') return 'All shops';
    const count = member.allowed_shop_ids?.length || 0;
    if (count === 0) return 'No shops';
    return `${count} shop${count > 1 ? 's' : ''}`;
  };

  const canManageTeam = user?.role === 'owner' || user?.role === 'admin';
  const etsyShop = Array.isArray(shops) ? shops.find(s => s.status === 'connected') : null;
  const tabs = [
    { id: 'connections' as TabType, label: 'Connections', icon: LinkIcon },
    { id: 'shops' as TabType, label: 'Shops', icon: Store },
    { id: 'team' as TabType, label: 'Team', icon: Users },
    { id: 'notifications' as TabType, label: 'Notifications', icon: Bell }
  ];
  if (user?.role === 'supplier') {
    tabs.splice(3, 0, { id: 'supplier_profile' as TabType, label: 'Supplier Profile', icon: Truck });
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-[var(--primary)]/30">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
          <p className="text-[var(--text-muted)]">Manage your Etsy shop connections and team</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => {
              setActiveTab(tab.id);
              router.push(`/settings?tab=${tab.id}`);
            }} 
            className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative', activeTab === tab.id ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}
          >
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
        </div>
      )}

      {activeTab === 'supplier_profile' && (
        <div className="space-y-6">
          <DashboardCard>
            <div className="flex items-center gap-3 mb-4">
              <Truck className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Supplier Profile</h2>
            </div>
            {loadingSupplierProfile ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Company Name</p>
                  <input
                    value={supplierProfile?.company_name || ''}
                    onChange={(e) => handleSupplierProfileChange('company_name', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Contact Name</p>
                  <input
                    value={supplierProfile?.contact_name || ''}
                    onChange={(e) => handleSupplierProfileChange('contact_name', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Email</p>
                  <input
                    value={supplierProfile?.email || ''}
                    onChange={(e) => handleSupplierProfileChange('email', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Phone</p>
                  <input
                    value={supplierProfile?.phone || ''}
                    onChange={(e) => handleSupplierProfileChange('phone', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Address Line 1</p>
                  <input
                    value={supplierProfile?.address_line1 || ''}
                    onChange={(e) => handleSupplierProfileChange('address_line1', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Address Line 2</p>
                  <input
                    value={supplierProfile?.address_line2 || ''}
                    onChange={(e) => handleSupplierProfileChange('address_line2', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">City</p>
                  <input
                    value={supplierProfile?.city || ''}
                    onChange={(e) => handleSupplierProfileChange('city', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">State</p>
                  <input
                    value={supplierProfile?.state || ''}
                    onChange={(e) => handleSupplierProfileChange('state', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Postal Code</p>
                  <input
                    value={supplierProfile?.postal_code || ''}
                    onChange={(e) => handleSupplierProfileChange('postal_code', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">Country</p>
                  <input
                    value={supplierProfile?.country || ''}
                    onChange={(e) => handleSupplierProfileChange('country', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-[var(--text-muted)] mb-1">Notes</p>
                  <textarea
                    value={supplierProfile?.notes || ''}
                    onChange={(e) => handleSupplierProfileChange('notes', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] min-h-[120px]"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    onClick={saveSupplierProfile}
                    disabled={savingSupplierProfile}
                    className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {savingSupplierProfile ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}
          </DashboardCard>
        </div>
      )}

      {activeTab === 'shops' && (
        <div className="space-y-6">
          <DashboardCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3"><Store className="w-5 h-5 text-[var(--warning)]" /><h2 className="text-lg font-semibold text-[var(--text-primary)]">Etsy Shop</h2></div>
              {etsyShop ? <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--success-bg)] text-[var(--success)] rounded-full text-sm"><CheckCircle className="w-4 h-4" />Connected</div> : <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] text-[var(--text-muted)] rounded-full text-sm"><XCircle className="w-4 h-4" />Not Connected</div>}
            </div>
            {isLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
            : (
              <div className="space-y-4">
                {/* Hide Connect Etsy for suppliers - they inherit shop access via organization */}
                {user?.role === 'supplier' ? (
                  <div className="p-4 bg-[var(--info-bg)] border border-[var(--info)]/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[var(--info)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[var(--text-primary)] font-medium mb-1">Shop Access via Organization</p>
                        <p className="text-[var(--text-secondary)] text-sm">
                          As a supplier, you have access to shop data through your organization membership. 
                          Only shop owners can connect Etsy accounts.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[var(--text-muted)] text-sm">Connect your Etsy shop to start automating listings, orders, and inventory management.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={shopNameInput}
                        onChange={(e) => setShopNameInput(e.target.value)}
                        placeholder="Shop display name"
                        className="flex-1 px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                      <button onClick={handleConnectEtsy} disabled={connectingEtsy} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--warning)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                        {connectingEtsy ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><LinkIcon className="w-4 h-4" />Create Connection Link</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </DashboardCard>

          {shops.length > 0 && (
            <DashboardCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Your Shops</h2>
                <span className="text-sm text-[var(--text-muted)]">{shops.length} total</span>
              </div>
              <div className="space-y-3">
                {shops.map((shop) => (
                  <div key={shop.id} className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                        <div>
                          <p className="text-sm text-[var(--text-muted)]">Shop Name</p>
                          {editingShopId === shop.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                value={shopNameDraft}
                                onChange={(e) => setShopNameDraft(e.target.value)}
                                className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                              />
                              <button
                                onClick={() => handleSaveRename(shop.id)}
                                disabled={savingShopName}
                                className="px-3 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                              >
                                {savingShopName ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelRename}
                                className="px-3 py-2 bg-[var(--background)] text-[var(--text-muted)] rounded-lg border border-[var(--border-color)]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-[var(--text-primary)] font-medium">{shop.display_name || 'Unnamed shop'}</p>
                              <button
                                onClick={() => handleStartRename(shop.id, shop.display_name || '')}
                                className="text-[var(--primary)] text-sm hover:underline"
                              >
                                Rename
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-[var(--text-muted)]">Shop ID</p>
                          <p className="text-[var(--text-primary)] font-mono text-sm">{shop.etsy_shop_id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-[var(--text-muted)]">Status</p>
                          <div className="flex items-center gap-2">
                            {shop.status === 'connected' ? (
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--success-bg)] text-[var(--success)] rounded-full text-sm">
                                <CheckCircle className="w-4 h-4" />Connected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] text-[var(--text-muted)] rounded-full text-sm">
                                <XCircle className="w-4 h-4" />Not Connected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Hide Disconnect for suppliers - policy compliance */}
                      {user?.role !== 'supplier' && (
                        <div className="flex items-center gap-2">
                          {shop.status === 'connected' ? (
                            <button onClick={() => handleDisconnectShop(shop.id, shop.display_name)} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--danger-bg)] text-[var(--danger)] rounded-lg hover:bg-[var(--danger)]/20">
                              <Unlink className="w-4 h-4" />Disconnect
                            </button>
                          ) : (
                            <button onClick={handleConnectEtsy} disabled={connectingEtsy} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--warning)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                              <LinkIcon className="w-4 h-4" />Reconnect
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteShop(shop.id, shop.display_name || shop.etsy_shop_id)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600/10 text-red-500 rounded-lg hover:bg-red-600/20 transition-colors"
                            title="Permanently delete this shop and all its data"
                          >
                            <Trash2 className="w-4 h-4" />Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>
          )}
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
                        <div className="flex items-center gap-2">
                          <p className="text-[var(--text-primary)] font-medium">{member.name}</p>
                          {member.user_id === user?.id && <span className="px-2 py-0.5 bg-[var(--primary-bg)] text-[var(--primary)] text-xs rounded">You</span>}
                          {member.invitation_status === 'pending' && (
                            <span className="px-2 py-0.5 bg-[var(--warning-bg)] text-[var(--warning)] text-xs rounded flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', getRoleColor(member.role))}>{getRoleIcon(member.role)}<span className="text-sm font-medium capitalize">{member.role}</span></div>
                      <span className="px-2 py-1 rounded-full text-xs bg-[var(--background)] text-[var(--text-muted)] border border-[var(--border-color)]">
                        {getShopAccessLabel(member)}
                      </span>
                      {canManageTeam && member.user_id !== user?.id && (member.role === 'viewer' || member.role === 'supplier') && (
                        <button
                          onClick={() => openShopAccessModal(member)}
                          className="px-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          Shop Access
                        </button>
                      )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0', getRoleColor('supplier'))}>
                  {getRoleIcon('supplier')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Supplier</h3>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Limited access to assigned orders only. Can update shipment and tracking details, but cannot view pricing, manage listings, or access team settings.
                  </p>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {activeTab === 'notifications' && <DashboardCard><div className="text-center py-12"><Bell className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" /><p className="text-[var(--text-muted)]">Coming soon.</p></div></DashboardCard>}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-[var(--text-primary)]">Invite Member</h2><button onClick={() => setShowInviteModal(false)} className="text-[var(--text-muted)]"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label><input type="text" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" /></div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg">Cancel</button>
              <button onClick={handleInviteMember} disabled={inviting} className="flex-1 px-4 py-3 gradient-primary text-white rounded-lg disabled:opacity-50 shadow-lg shadow-[var(--primary)]/25">{inviting ? 'Inviting...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Shop Access Modal */}
      {shopAccessMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Shop Access</h2>
              <button onClick={closeShopAccessModal} className="text-[var(--text-muted)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Select the shops {shopAccessMember.name} can access. Changes apply after next login.
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {shops.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No shops connected yet.</p>
              ) : (
                shops.map((shop) => (
                  <label key={shop.id} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
                    <input
                      type="checkbox"
                      checked={shopAccessSelections.includes(shop.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShopAccessSelections((prev) => [...prev, shop.id]);
                        } else {
                          setShopAccessSelections((prev) => prev.filter((id) => id !== shop.id));
                        }
                      }}
                    />
                    <div>
                      <p className="text-[var(--text-primary)] font-medium">{shop.display_name || 'Unnamed shop'}</p>
                      <p className="text-xs text-[var(--text-muted)]">{shop.etsy_shop_id}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeShopAccessModal} className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg">Cancel</button>
              <button onClick={saveShopAccess} disabled={savingShopAccess} className="flex-1 px-4 py-3 gradient-primary text-white rounded-lg disabled:opacity-50 shadow-lg shadow-[var(--primary)]/25">
                {savingShopAccess ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Shop Confirmation Modal */}
      <ConfirmModal
        isOpen={showDisconnectModal}
        onClose={() => {
          setShowDisconnectModal(false);
          setShopToDisconnect(null);
        }}
        onConfirm={confirmDisconnectShop}
        title="Disconnect Etsy Shop"
        message={`Are you sure you want to disconnect ${shopToDisconnect?.name || 'this shop'}? You will need to reconnect and reauthorize to use this shop again.`}
        confirmText="Disconnect Shop"
        cancelText="Cancel"
        variant="warning"
        isProcessing={disconnecting}
      />

      {/* Delete Member Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setMemberToDelete(null);
        }}
        onConfirm={confirmRemoveMember}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToDelete?.name || 'this member'}? They will immediately lose access to the workspace and all its resources.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="danger"
        isProcessing={deleting}
      />

      {/* Connection Link Modal */}
      {showConnectLinkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Connection Link Created</h3>
              <button onClick={() => setShowConnectLinkModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Share this link to connect an Etsy shop. The link expires in 30 minutes and can only be used once.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={generatedConnectUrl}
                className="flex-1 px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyConnectLink}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 flex-shrink-0"
              >
                {connectLinkCopied ? <><CheckCircle2 className="w-4 h-4" />Copied!</> : <><LinkIcon className="w-4 h-4" />Copy Link</>}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>This link expires in 30 minutes</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shop Confirmation Modal */}
      {showDeleteShopModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Permanently Delete Shop</h3>
                <p className="text-sm text-[var(--text-muted)]">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400">
                This will permanently delete <strong>{shopToDelete?.name}</strong> and all associated data including orders, products, listings, invoices, and tokens.
              </p>
            </div>
            <div>
              <label className="text-sm text-[var(--text-muted)] block mb-1">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteShopModal(false); setShopToDelete(null); setDeleteConfirmText(''); }}
                className="px-4 py-2.5 bg-[var(--background)] text-[var(--text-muted)] rounded-lg border border-[var(--border-color)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteShop}
                disabled={deleteConfirmText !== 'DELETE' || deletingShop}
                className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingShop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingShop ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.show}
        onClose={() => setNotification({ ...notification, show: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        autoClose={true}
        autoCloseDuration={4000}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <React.Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
        </div>
      }>
        <SettingsContent />
      </React.Suspense>
    </DashboardLayout>
  );
}
