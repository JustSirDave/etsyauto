'use client';

/**
 * Settings Page - Vuexy Style
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { useLanguage } from '@/lib/language-context';
import { shopsApi, teamApi, userPreferencesApi, currencyApi, notificationsApi, type Shop, type ApiError, type TeamMember, type Notification } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { NotificationModal } from '@/components/modals/NotificationModal';
import { ConnectionsTab } from '@/components/settings/ConnectionsTab';
import { ShopsTab } from '@/components/settings/ShopsTab';
import { TeamTab } from '@/components/settings/TeamTab';
import { CurrencyTab } from '@/components/settings/CurrencyTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';
import { MessagingTab } from '@/components/settings/MessagingTab';
import {
  Settings as SettingsIcon,
  Store,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Bell,
  DollarSign,
  MessageSquare,
  X,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'connections' | 'shops' | 'team' | 'notifications' | 'currency' | 'messaging';

export function SettingsContent() {
  const { user } = useAuth();
  const { refreshShops } = useShop();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const activationToken = searchParams.get('token');
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
  const [preferredCurrency, setPreferredCurrency] = useState<string>('USD');
  const [loadingCurrency, setLoadingCurrency] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ show: false, type: 'success', title: '', message: '' });
  const [messagingConfig, setMessagingConfig] = useState({
    imap_host: '',
    imap_email: '',
    imap_password: '',
    adspower_profile_id: '',
  });
  const [loadingMessaging, setLoadingMessaging] = useState(false);
  const [savingMessaging, setSavingMessaging] = useState(false);
  const [selectedShopForMessaging, setSelectedShopForMessaging] = useState<number | null>(null);
  const [notifList, setNotifList] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifUnreadOnly, setNotifUnreadOnly] = useState(false);

  useEffect(() => { loadShops(); }, []);
  useEffect(() => { if (activeTab === 'team') loadTeamMembers(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'currency') loadCurrencyPrefs(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'notifications') loadNotifications(); }, [activeTab, notifUnreadOnly]);
  useEffect(() => {
    if (activeTab === 'messaging' && selectedShopForMessaging) {
      loadMessagingConfig(selectedShopForMessaging);
    }
  }, [activeTab, selectedShopForMessaging]);
  useEffect(() => {
    if (searchParams.get('etsy') === 'connected') {
      setNotification({
        show: true,
        type: 'success',
        title: t('settings.shopConnected') || 'Shop Connected',
        message: t('settings.shopConnectedMsg') || 'Your Etsy shop has been successfully connected.',
      });
      window.history.replaceState({}, '', '/settings?tab=shops');
    }
  }, [searchParams]);

  const loadCurrencyPrefs = async () => {
    try {
      setLoadingCurrency(true);
      const [prefs, supported] = await Promise.all([
        userPreferencesApi.get(),
        currencyApi.getSupported(),
      ]);
      setPreferredCurrency(prefs.preferred_currency_code);
      setSupportedCurrencies(supported.currencies || []);
    } catch {
      setSupportedCurrencies(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ILS', 'JPY', 'MXN', 'BRL']);
    } finally {
      setLoadingCurrency(false);
    }
  };

  const saveCurrencyPreference = async () => {
    try {
      setSavingCurrency(true);
      const updated = await userPreferencesApi.update(preferredCurrency);
      setPreferredCurrency(updated.preferred_currency_code);
      setNotification({
        show: true,
        type: 'success',
        title: t('settings.currencySaved'),
        message: t('settings.currencySavedMessage').replace('{currency}', preferredCurrency),
      });
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: t('settings.saveFailed'),
        message: (err as ApiError).detail || t('settings.currencySaveFailed'),
      });
    } finally {
      setSavingCurrency(false);
    }
  };

  const loadMessagingConfig = async (shopId: number) => {
    try {
      setLoadingMessaging(true);
      const data = await shopsApi.getMessagingConfig(shopId);
      setMessagingConfig({
        imap_host: data.imap_host || '',
        imap_email: data.imap_email || '',
        imap_password: '',
        adspower_profile_id: data.adspower_profile_id || '',
      });
    } catch {
      // Leave form empty on error or 404
    } finally {
      setLoadingMessaging(false);
    }
  };

  const saveMessagingConfig = async () => {
    if (!selectedShopForMessaging) return;
    try {
      setSavingMessaging(true);
      await shopsApi.updateMessagingConfig(selectedShopForMessaging, messagingConfig);
      setNotification({
        show: true,
        type: 'success',
        title: 'Messaging Config Saved',
        message: 'IMAP and AdsPower settings saved successfully.',
      });
    } catch {
      setNotification({
        show: true,
        type: 'error',
        title: 'Save Failed',
        message: 'Could not save messaging configuration.',
      });
    } finally {
      setSavingMessaging(false);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const data = await notificationsApi.getAll(0, 50, notifUnreadOnly);
      setNotifList(data);
    } catch {
      setNotifList([]);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleNotifMarkRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* ignore */ }
  };

  const handleNotifMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifList((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  const handleNotifDelete = async (id: number) => {
    try {
      await notificationsApi.delete(id);
      setNotifList((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
  };

  const handleNotifDeleteAll = async () => {
    try {
      await notificationsApi.deleteAll();
      setNotifList([]);
    } catch { /* ignore */ }
  };

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const loadShops = async () => {
    try { setIsLoading(true); setError(null); const data = await shopsApi.getAll(); setShops(Array.isArray(data) ? data : []); }
    catch (err) { setError((err as ApiError).detail || t('settings.loadShopsFailed')); setShops([]); }
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
      setError((err as ApiError).detail || t('settings.generateLinkFailed'));
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
      setError(t('settings.copyFailed'));
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
      setError(t('settings.shopNameRequired'));
      return;
    }
    try {
      setSavingShopName(true);
      setError(null);
      await shopsApi.updateDisplayName(shopId, shopNameDraft.trim());
      setEditingShopId(null);
      await loadShops();
    } catch (err) {
      setError((err as ApiError).detail || t('settings.updateShopNameFailed'));
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
      setError((err as ApiError).detail || t('settings.updateShopAccessFailed'));
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
        title: t('settings.shopDeleted'),
        message: t('settings.shopDeletedMessage').replace('{name}', shopToDelete.name)
      });
      setShopToDelete(null);
      setDeleteConfirmText('');
      await loadShops();
      refreshShops();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: t('settings.deletionFailed'),
        message: (err as ApiError).detail || t('settings.deleteShopFailed')
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
        title: t('settings.shopDisconnected'),
        message: t('settings.shopDisconnectedMessage').replace('{name}', shopToDisconnect.name)
      });
      setShopToDisconnect(null);
      await loadShops();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: t('settings.disconnectionFailed'),
        message: (err as ApiError).detail || t('settings.disconnectFailed')
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const loadTeamMembers = async () => {
    try { setLoadingTeam(true); setError(null); const members = await teamApi.getMembers(); setTeamMembers(members); }
    catch (err) { setError((err as ApiError).detail || t('settings.loadFailed')); } finally { setLoadingTeam(false); }
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      setNotification({
        show: true,
        type: 'error',
        title: t('settings.missingInformation'),
        message: t('settings.fillAllFields')
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
        title: t('settings.invitationSent'),
        message: t('settings.invitationSentMessage').replace('{email}', inviteForm.email)
      });
      await loadTeamMembers();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: t('settings.invitationFailed'),
        message: (err as ApiError).detail || t('settings.sendInvitationFailed')
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
        title: t('settings.memberRemoved'),
        message: t('settings.memberRemovedMessage').replace('{name}', memberToDelete.name)
      });
      setMemberToDelete(null);
      await loadTeamMembers();
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        title: t('settings.removalFailed'),
        message: (err as ApiError).detail || t('settings.removeMemberFailed')
      });
    } finally {
      setDeleting(false);
    }
  };

  const canManageTeam = user?.role === 'owner' || user?.role === 'admin';
  const messagingApproved = user?.messaging_access === 'approved';
  const showMessagingTab = messagingApproved || !!activationToken;
  const etsyShop = Array.isArray(shops) ? shops.find(s => s.status === 'connected') : null;
  const tabs = [
    { id: 'connections' as TabType, label: t('settings.tabs.connections'), icon: LinkIcon },
    { id: 'shops' as TabType, label: t('settings.tabs.shops'), icon: Store },
    { id: 'team' as TabType, label: t('settings.tabs.team'), icon: Users },
    { id: 'currency' as TabType, label: t('settings.tabs.currency'), icon: DollarSign },
    { id: 'messaging' as TabType, label: 'Messaging', icon: MessageSquare },
    { id: 'notifications' as TabType, label: t('settings.tabs.notifications'), icon: Bell }
  ].filter((tab) => tab.id !== 'messaging' || showMessagingTab);


  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-[var(--primary)]/30">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('settings.title')}</h1>
          <p className="text-[var(--text-muted)]">{t('settings.subtitle')}</p>
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
        <ConnectionsTab user={user} shops={shops} />
      )}

      {activeTab === 'shops' && (
        <ShopsTab
          shops={shops}
          loading={isLoading}
          onRefresh={loadShops}
          user={user}
          etsyShop={etsyShop}
          shopNameInput={shopNameInput}
          onShopNameInputChange={setShopNameInput}
          connectingEtsy={connectingEtsy}
          onConnectEtsy={handleConnectEtsy}
          editingShopId={editingShopId}
          shopNameDraft={shopNameDraft}
          onShopNameDraftChange={setShopNameDraft}
          savingShopName={savingShopName}
          onStartRename={handleStartRename}
          onCancelRename={handleCancelRename}
          onSaveRename={handleSaveRename}
          onDisconnectShop={handleDisconnectShop}
          onDeleteShop={handleDeleteShop}
        />
      )}

      {activeTab === 'team' && (
        <TeamTab
          teamMembers={teamMembers}
          loading={loadingTeam}
          onRefresh={loadTeamMembers}
          user={user}
          canManageTeam={canManageTeam}
          onOpenInvite={() => setShowInviteModal(true)}
          onOpenShopAccess={openShopAccessModal}
          onRemoveMember={handleRemoveMember}
        />
      )}

      {activeTab === 'currency' && (
        <CurrencyTab
          currencyPrefs={{
            preferredCurrency,
            onPreferredCurrencyChange: setPreferredCurrency,
            supportedCurrencies,
            dropdownOpen: currencyDropdownOpen,
            onDropdownOpenChange: setCurrencyDropdownOpen,
          }}
          loading={loadingCurrency}
          saving={savingCurrency}
          onSave={saveCurrencyPreference}
        />
      )}

      {activeTab === 'messaging' && (
        <MessagingTab
          activationToken={activationToken}
          messagingApproved={messagingApproved}
          selectedShop={selectedShopForMessaging}
          onSelectedShopChange={setSelectedShopForMessaging}
          shops={shops}
          messagingConfig={messagingConfig}
          onMessagingConfigChange={setMessagingConfig}
          loadingMessaging={loadingMessaging}
          savingMessaging={savingMessaging}
          onSaveMessagingConfig={saveMessagingConfig}
        />
      )}

      {activeTab === 'notifications' && (
        <NotificationsTab
          notifications={notifList}
          loading={loadingNotifs}
          unreadOnly={notifUnreadOnly}
          onUnreadOnlyChange={setNotifUnreadOnly}
          onRefresh={loadNotifications}
          onMarkRead={handleNotifMarkRead}
          onMarkAllRead={handleNotifMarkAllRead}
          onDelete={handleNotifDelete}
          onDeleteAll={handleNotifDeleteAll}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-[var(--text-primary)]">{t('settings.inviteMember')}</h2><button onClick={() => setShowInviteModal(false)} className="text-[var(--text-muted)]"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('common.email')}</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('common.name')}</label><input type="text" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" /></div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t('common.role')}</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="admin">{t('settings.roles.admin')}</option>
                  <option value="viewer">{t('settings.roles.viewer')}</option>
                  <option value="member">{t('settings.roles.member')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg">{t('common.cancel')}</button>
              <button onClick={handleInviteMember} disabled={inviting} className="flex-1 px-4 py-3 gradient-primary text-white rounded-lg disabled:opacity-50 shadow-lg shadow-[var(--primary)]/25">{inviting ? t('settings.inviting') : t('common.send')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Shop Access Modal */}
      {shopAccessMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('settings.shopAccess')}</h2>
              <button onClick={closeShopAccessModal} className="text-[var(--text-muted)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              {t('settings.selectShopsMessage').replace('{name}', shopAccessMember.name)}
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {shops.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t('settings.noShopsConnected')}</p>
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
                      <p className="text-[var(--text-primary)] font-medium">{shop.display_name || t('settings.unnamedShop')}</p>
                      <p className="text-xs text-[var(--text-muted)]">{shop.etsy_shop_id}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeShopAccessModal} className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg">{t('common.cancel')}</button>
              <button onClick={saveShopAccess} disabled={savingShopAccess} className="flex-1 px-4 py-3 gradient-primary text-white rounded-lg disabled:opacity-50 shadow-lg shadow-[var(--primary)]/25">
                {savingShopAccess ? t('common.saving') : t('common.save')}
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
        title={t('settings.disconnectTitle')}
        message={t('settings.disconnectMessage').replace('{name}', shopToDisconnect?.name || 'this shop')}
        confirmText={t('settings.disconnectShop')}
        cancelText={t('common.cancel')}
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
        title={t('settings.removeMemberTitle')}
        message={t('settings.removeMemberMessage').replace('{name}', memberToDelete?.name || 'this member')}
        confirmText={t('settings.removeMember')}
        cancelText={t('common.cancel')}
        variant="danger"
        isProcessing={deleting}
      />

      {/* Connection Link Modal */}
      {showConnectLinkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.connectionLinkCreated')}</h3>
              <button onClick={() => setShowConnectLinkModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {t('settings.shareLinkMessage')}
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
                {connectLinkCopied ? <><CheckCircle2 className="w-4 h-4" />{t('settings.copied')}</> : <><LinkIcon className="w-4 h-4" />{t('settings.copyLink')}</>}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{t('settings.linkExpires')}</span>
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
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.deleteShopTitle')}</h3>
                <p className="text-sm text-[var(--text-muted)]">{t('settings.deleteShopWarning')}</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400">
                {t('settings.deleteShopMessage').replace('{name}', shopToDelete?.name || '')}
              </p>
            </div>
            <div>
              <label className="text-sm text-[var(--text-muted)] block mb-1">
                {`Type ${(shopToDelete?.name || '').toUpperCase()} to confirm`}
              </label>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={(shopToDelete?.name || '').toUpperCase()}
                className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteShopModal(false); setShopToDelete(null); setDeleteConfirmText(''); }}
                className="px-4 py-2.5 bg-[var(--background)] text-[var(--text-muted)] rounded-lg border border-[var(--border-color)] hover:text-[var(--text-primary)]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDeleteShop}
                disabled={deleteConfirmText !== (shopToDelete?.name || '').toUpperCase() || deletingShop}
                className="px-4 py-2.5 bg-red-800 text-white rounded-lg hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingShop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingShop ? t('settings.deleting') : t('settings.deletePermanently')}
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
