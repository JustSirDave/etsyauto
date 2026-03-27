'use client';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { MessageSquare, Loader2 } from 'lucide-react';
import { MessagingActivationWizard } from '@/components/settings/MessagingActivationWizard';
import type { Shop } from '@/lib/api';

export interface MessagingConfigState {
  imap_host: string;
  imap_email: string;
  imap_password: string;
  adspower_profile_id: string;
}

export interface MessagingTabProps {
  activationToken: string | null;
  messagingApproved: boolean;
  selectedShop: number | null;
  onSelectedShopChange: (shopId: number) => void;
  shops: Shop[];
  toast?: unknown;
  onActivationComplete?: () => void | Promise<void>;
  messagingConfig: MessagingConfigState;
  onMessagingConfigChange: (config: MessagingConfigState) => void;
  loadingMessaging: boolean;
  savingMessaging: boolean;
  onSaveMessagingConfig: () => void | Promise<void>;
}

export function MessagingTab({
  activationToken,
  messagingApproved,
  selectedShop: selectedShopForMessaging,
  onSelectedShopChange: setSelectedShopForMessaging,
  shops,
  messagingConfig,
  onMessagingConfigChange: setMessagingConfig,
  loadingMessaging,
  savingMessaging,
  onSaveMessagingConfig: saveMessagingConfig,
}: MessagingTabProps) {
  return (
    <>
      {activationToken && <MessagingActivationWizard token={activationToken} />}

      {!activationToken && messagingApproved && (
        <div className="space-y-6">
          <DashboardCard>
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Messaging Automation</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Configure IMAP email monitoring and AdsPower browser profile per shop to enable automated message
              reading and replies.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Shop</label>
              <select
                value={selectedShopForMessaging || ''}
                onChange={(e) => setSelectedShopForMessaging(Number(e.target.value))}
                className="w-full max-w-xs px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              >
                <option value="">-- Select a shop --</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name || s.etsy_shop_id}
                  </option>
                ))}
              </select>
            </div>

            {selectedShopForMessaging ? (
              loadingMessaging ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-1">IMAP Host</p>
                    <input
                      value={messagingConfig.imap_host}
                      onChange={(e) => setMessagingConfig({ ...messagingConfig, imap_host: e.target.value })}
                      placeholder="imap.gmail.com"
                      className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-1">IMAP Email</p>
                    <input
                      value={messagingConfig.imap_email}
                      onChange={(e) => setMessagingConfig({ ...messagingConfig, imap_email: e.target.value })}
                      placeholder="shop@gmail.com"
                      className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-1">App Password</p>
                    <input
                      type="password"
                      value={messagingConfig.imap_password}
                      onChange={(e) => setMessagingConfig({ ...messagingConfig, imap_password: e.target.value })}
                      placeholder="Leave blank to keep existing"
                      className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-1">AdsPower Profile ID</p>
                    <input
                      value={messagingConfig.adspower_profile_id}
                      onChange={(e) =>
                        setMessagingConfig({ ...messagingConfig, adspower_profile_id: e.target.value })
                      }
                      placeholder="e.g. jd8k2m"
                      className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      onClick={saveMessagingConfig}
                      disabled={savingMessaging}
                      className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {savingMessaging ? 'Saving...' : 'Save Messaging Config'}
                    </button>
                  </div>
                </div>
              )
            ) : null}
          </DashboardCard>
        </div>
      )}

      {!activationToken && !messagingApproved && (
        <DashboardCard>
          <div className="py-8 text-center text-[var(--text-muted)] text-sm">
            You don&apos;t have messaging access yet. Contact support at{' '}
            <a href="mailto:support@etsyauto.com" className="text-[var(--primary)] font-medium">
              support@etsyauto.com
            </a>{' '}
            to request access.
          </div>
        </DashboardCard>
      )}
    </>
  );
}
