'use client';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Store,
  Link as LinkIcon,
  Unlink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import type { Shop, User } from '@/lib/api';

export interface ShopsTabProps {
  shops: Shop[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  toast?: unknown;
  user: User | null | undefined;
  etsyShop: Shop | null | undefined;
  shopNameInput: string;
  onShopNameInputChange: (value: string) => void;
  connectingEtsy: boolean;
  onConnectEtsy: () => void | Promise<void>;
  editingShopId: number | null;
  shopNameDraft: string;
  onShopNameDraftChange: (value: string) => void;
  savingShopName: boolean;
  onStartRename: (shopId: number, currentName: string) => void;
  onCancelRename: () => void;
  onSaveRename: (shopId: number) => void | Promise<void>;
  onDisconnectShop: (shopId: number, shopName: string) => void;
  onDeleteShop: (shopId: number, shopName: string) => void;
}

export function ShopsTab({
  shops,
  loading: isLoading,
  user,
  etsyShop,
  shopNameInput,
  onShopNameInputChange,
  connectingEtsy,
  onConnectEtsy,
  editingShopId,
  shopNameDraft,
  onShopNameDraftChange,
  savingShopName,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onDisconnectShop,
  onDeleteShop,
}: ShopsTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <DashboardCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Store className="w-5 h-5 text-[var(--warning)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t('settings.etsyShop')}
            </h2>
          </div>
          {etsyShop ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--success-bg)] text-[var(--success)] rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              {t('common.connected')}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] text-[var(--text-muted)] rounded-full text-sm">
              <XCircle className="w-4 h-4" />
              {t('common.notConnected')}
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[var(--text-muted)] text-sm">{t('settings.connectEtsyDescription')}</p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              The term &ldquo;Etsy&rdquo; is a trademark of Etsy, Inc. This application uses the Etsy API
              but is not endorsed or certified by Etsy, Inc.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={shopNameInput}
                onChange={(e) => onShopNameInputChange(e.target.value)}
                placeholder={t('settings.shopDisplayName')}
                className="flex-1 px-3 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
              <button
                onClick={() => void onConnectEtsy()}
                disabled={connectingEtsy}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--warning)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {connectingEtsy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('settings.generating')}
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" />
                    {t('settings.createConnectionLink')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </DashboardCard>

      {shops.length > 0 && (
        <DashboardCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.yourShops')}</h2>
            <span className="text-sm text-[var(--text-muted)]">
              {shops.length} {t('common.total')}
            </span>
          </div>
          <div className="space-y-3">
            {shops.map((shop) => (
              <div key={shop.id} className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                    <div>
                      <p className="text-sm text-[var(--text-muted)]">{t('settings.shopName')}</p>
                      {editingShopId === shop.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            value={shopNameDraft}
                            onChange={(e) => onShopNameDraftChange(e.target.value)}
                            className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                          />
                          <button
                            onClick={() => void onSaveRename(shop.id)}
                            disabled={savingShopName}
                            className="px-3 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                          >
                            {savingShopName ? t('common.saving') : t('common.save')}
                          </button>
                          <button
                            onClick={onCancelRename}
                            className="px-3 py-2 bg-[var(--background)] text-[var(--text-muted)] rounded-lg border border-[var(--border-color)]"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-[var(--text-primary)] font-medium">
                            {shop.display_name || t('settings.unnamedShop')}
                          </p>
                          <button
                            onClick={() => onStartRename(shop.id, shop.display_name || '')}
                            className="text-[var(--primary)] text-sm hover:underline"
                          >
                            {t('common.rename')}
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-muted)]">{t('settings.shopId')}</p>
                      <p className="text-[var(--text-primary)] font-mono text-sm">{shop.etsy_shop_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-muted)]">{t('common.status')}</p>
                      <div className="flex items-center gap-2">
                        {shop.status === 'connected' && shop.token_health?.token_valid ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--success-bg)] text-[var(--success)] rounded-full text-sm">
                            <CheckCircle className="w-4 h-4" />
                            {t('common.connected')}
                          </span>
                        ) : shop.status === 'revoked' ||
                          (shop.status === 'connected' && shop.token_health && !shop.token_health.token_valid) ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-full text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {shop.status === 'revoked' ? 'Revoked' : 'Token Expired'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] text-[var(--text-muted)] rounded-full text-sm">
                            <XCircle className="w-4 h-4" />
                            {t('common.notConnected')}
                          </span>
                        )}
                        {shop.token_health?.last_refreshed_at && (
                          <p className="text-[var(--text-muted)] text-xs mt-1">
                            Last refreshed: {new Date(shop.token_health.last_refreshed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {user?.role !== 'member' && user?.role !== 'viewer' && (
                    <div className="flex items-center gap-2">
                      {shop.status === 'connected' ? (
                        <button
                          onClick={() => onDisconnectShop(shop.id, shop.display_name)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--danger-bg)] text-[var(--danger)] rounded-lg hover:bg-[var(--danger)]/20"
                        >
                          <Unlink className="w-4 h-4" />
                          {t('common.disconnect')}
                        </button>
                      ) : (
                        <button
                          onClick={() => void onConnectEtsy()}
                          disabled={connectingEtsy}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--warning)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                          <LinkIcon className="w-4 h-4" />
                          {t('common.reconnect')}
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteShop(shop.id, shop.display_name || shop.etsy_shop_id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors"
                        title={t('settings.deleteShopTooltip')}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('common.delete')}
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
  );
}
