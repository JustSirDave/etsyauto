'use client';

/**
 * Financial Analytics Page
 * Displays P&L summary, payout estimate, fee breakdown chart,
 * revenue timeline, and a searchable ledger table.
 *
 * Owner / Admin / Viewer only (via require_revenue_access on backend).
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { useToast } from '@/lib/toast-context';
import { useLanguage } from '@/lib/language-context';
import { DisconnectedShopBanner } from '@/components/ui/DisconnectedShopBanner';
import {
  financialsApi,
  invoicesApi,
  type ProfitAndLoss,
  type PayoutEstimate,
  type FeeBreakdown,
  type RevenueTimeline,
  type LedgerResponse,
  type LedgerEntryData,
  type BillingScopeStatus,
  type FinancialSummary,
  type Invoice,
  type InvoiceListResponse,
  type SyncStatusResponse,
  type DiscountSummary,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Calendar,
  PieChart,
  BarChart3,
  Receipt,
  Banknote,
  ShieldAlert,
  Tag,
  Megaphone,
  Truck,
  CreditCard,
  RotateCcw,
  Package,
  FileUp,
  Percent,
  Clock,
} from 'lucide-react';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Convert cents to formatted dollar string */
function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Format amount, using converted value when available */
function formatWithConversion(
  amount: number,
  currency: string,
  convertedAmount?: number | null,
  convertedCurrency?: string | null
): string {
  const amt = convertedAmount != null && convertedCurrency ? convertedAmount : amount;
  const ccy = convertedAmount != null && convertedCurrency ? convertedCurrency : currency;
  return formatCents(amt, ccy);
}

/** Short date display */
function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Build ISO date string from days-ago count */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Human-readable "X minutes ago" from ISO timestamp */
function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} days ago`;
}

/** Pretty entry type label (fallback for non-translated contexts) */
function entryTypeLabel(t: string): string {
  const map: Record<string, string> = {
    sale: 'Sale',
    refund: 'Refund',
    reserve: 'Reserve',
    payout: 'Payout',
    listing_renewal: 'Listing Renewal',
    transaction_fee: 'Transaction Fee',
    processing_fee: 'Processing Fee',
    advertising: 'Advertising',
    shipping_label: 'Shipping Label',
    subscription: 'Subscription',
    tax: 'Tax',
    other: 'Other',
  };
  return map[t] || t;
}

/** Translation key map for entry types */
const ENTRY_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  sale: 'financials.entryTypes.sale',
  refund: 'financials.entryTypes.refund',
  reserve: 'financials.entryTypes.reserve',
  payout: 'financials.entryTypes.payout',
  listing_renewal: 'financials.entryTypes.listingRenewal',
  transaction_fee: 'financials.entryTypes.transactionFee',
  processing_fee: 'financials.entryTypes.processingFee',
  advertising: 'financials.entryTypes.advertising',
  shipping_label: 'financials.entryTypes.shippingLabel',
  subscription: 'financials.entryTypes.subscription',
  tax: 'financials.entryTypes.tax',
  other: 'financials.entryTypes.other',
};

/** Icon for fee category */
function feeIcon(category: string) {
  const icons: Record<string, React.ReactNode> = {
    transaction_fee: <CreditCard className="w-4 h-4" />,
    processing_fee: <Receipt className="w-4 h-4" />,
    listing_renewal: <Tag className="w-4 h-4" />,
    advertising: <Megaphone className="w-4 h-4" />,
    shipping_label: <Truck className="w-4 h-4" />,
    subscription: <Wallet className="w-4 h-4" />,
  };
  return icons[category] || <DollarSign className="w-4 h-4" />;
}

/** Colour for entry type badge */
function entryTypeBadgeClasses(t: string): string {
  const map: Record<string, string> = {
    sale: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    refund: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    payout: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    reserve: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    transaction_fee: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    processing_fee: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    listing_renewal: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    advertising: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    shipping_label: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    subscription: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    tax: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
  };
  return map[t] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300';
}

/* ================================================================== */
/*  Period selector                                                    */
/* ================================================================== */

type Period = '7d' | '30d' | '90d' | '12m';

const PERIOD_OPTIONS: Period[] = ['7d', '30d', '90d', '12m'];

function periodToDates(p: Period): { start: string; end: string } {
  const end = new Date().toISOString();
  const days: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  return { start: daysAgo(days[p]), end };
}

/** Human-readable period label e.g. "Last 3 months: November 2025 - January 2026" */
function periodToLabel(p: Period): string {
  const { start, end } = periodToDates(p);
  const startDate = new Date(start);
  const endDate = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const labels: Record<Period, string> = {
    '7d': `Last 7 days: ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    '30d': `Last 30 days: ${fmt(startDate)} – ${fmt(endDate)}`,
    '90d': `Last 3 months: ${fmt(startDate)} – ${fmt(endDate)}`,
    '12m': `Last 12 months: ${fmt(startDate)} – ${fmt(endDate)}`,
  };
  return labels[p];
}

function periodToGranularity(p: Period): string {
  if (p === '7d') return 'daily';
  if (p === '30d') return 'daily';
  if (p === '90d') return 'weekly';
  return 'monthly';
}

/* ================================================================== */
/*  Expandable category card (Etsy-style)                              */
/* ================================================================== */

function ExpandableCard({
  title,
  totalValue,
  totalPositive,
  icon: Icon,
  children,
  defaultExpanded = false,
}: {
  title: string;
  totalValue: string;
  totalPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-lg font-semibold',
              totalPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {totalValue}
          </span>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t dark:border-gray-800 px-5 py-4 bg-gray-50/50 dark:bg-gray-800/30">
          {children}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Reusable mini-components                                           */
/* ================================================================== */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  positive,
  className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {subtitle && (
        <p
          className={cn(
            'mt-1 text-xs flex items-center gap-1',
            positive === true && 'text-emerald-600',
            positive === false && 'text-red-500',
            positive === undefined && 'text-gray-500 dark:text-gray-400'
          )}
        >
          {positive === true && <ArrowUpRight className="w-3 h-3" />}
          {positive === false && <ArrowDownRight className="w-3 h-3" />}
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */

function FinancialComparisonPanel({
  comparisonData,
  shops,
  onClose,
}: {
  comparisonData: Record<string, FinancialSummary>;
  shops: { id: number; display_name: string }[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const entries = Object.entries(comparisonData);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('financials.comparison')}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          {t('common.close')}
        </button>
      </div>
      <div className={`grid gap-4 ${entries.length === 2 ? 'grid-cols-2' : entries.length >= 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {entries.map(([shopId, summary]) => {
          const shop = shops.find((s) => s.id === Number(shopId));
          const shopName = shop?.display_name || `Shop ${shopId}`;
          return (
            <div key={shopId} className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h4 className="font-semibold text-sm border-b border-gray-200 dark:border-gray-700 pb-2">
                {shopName}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">{t('financials.revenue')}</p>
                  <p className="font-semibold text-green-600">{formatWithConversion(summary.revenue, summary.currency ?? 'USD', summary.converted_revenue, summary.converted_currency)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('financials.totalExpenses')}</p>
                  <p className="font-semibold text-red-500">{formatWithConversion(summary.total_expenses, summary.currency ?? 'USD', summary.converted_total_expenses, summary.converted_currency)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('financials.netProfit')}</p>
                  <p className="font-semibold text-blue-600">{formatWithConversion(summary.net_profit, summary.currency ?? 'USD', summary.converted_net_profit, summary.converted_currency)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('financials.etsyFees')}</p>
                  <p className="font-semibold">{formatWithConversion(summary.etsy_fees, summary.currency ?? 'USD', summary.converted_etsy_fees, summary.converted_currency)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('financials.advertising')}</p>
                  <p className="font-semibold">{formatWithConversion(summary.advertising_expenses, summary.currency ?? 'USD', summary.converted_advertising_expenses, summary.converted_currency)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Margin</p>
                  <p className="font-semibold">{summary.revenue > 0 ? ((summary.net_profit / summary.revenue) * 100).toFixed(1) : '0.0'}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FinancialsPage() {
  const { user } = useAuth();
  const { selectedShop, selectedShopIds, selectedShops } = useShop();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [scopeStatus, setScopeStatus] = useState<BillingScopeStatus | null>(null);
  const [comparisonData, setComparisonData] = useState<Record<string, FinancialSummary> | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Data
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [payout, setPayout] = useState<PayoutEstimate | null>(null);
  const [fees, setFees] = useState<FeeBreakdown | null>(null);
  const [timeline, setTimeline] = useState<RevenueTimeline | null>(null);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerFilter, setLedgerFilter] = useState('');
  const [invoices, setInvoices] = useState<InvoiceListResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showInvoiceUpload, setShowInvoiceUpload] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [discounts, setDiscounts] = useState<DiscountSummary | null>(null);

  const shopIds = selectedShopIds && selectedShopIds.length > 0 ? selectedShopIds : undefined;
  const shopId = !shopIds ? selectedShop?.id : undefined;
  const { start, end } = useMemo(() => periodToDates(period), [period]);

  /** Translate entry type using the translation function */
  const translateEntryType = (type: string): string => {
    const key = ENTRY_TYPE_TRANSLATION_KEYS[type];
    return key ? t(key) : type;
  };

  // ── Check scope status ──
  useEffect(() => {
    financialsApi.getScopeStatus(shopId).then(setScopeStatus).catch(() => {});
  }, [shopId]);

  // ── Fetch all data ──
  const fetchAll = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const [summaryData, pnlData, payoutData, feeData, timelineData, ledgerData, invoiceData, syncStatusData, discountsData] = await Promise.all([
        financialsApi.getSummary({ shopIds, shopId, startDate: start, endDate: end, forceRefresh }),
        financialsApi.getProfitAndLoss(shopId, start, end, shopIds),
        financialsApi.getPayoutEstimate(shopId, shopIds),
        financialsApi.getFeeBreakdown(shopId, start, end, shopIds),
        financialsApi.getTimeline(shopId, start, end, periodToGranularity(period), shopIds),
        financialsApi.getLedger(shopId, ledgerFilter || undefined, start, end, 15, ledgerPage * 15, shopIds),
        invoicesApi.list({ shopIds, shopId, limit: 10 }),
        financialsApi.getSyncStatus(shopId, shopIds),
        financialsApi.getDiscounts({ shopIds, shopId, startDate: start, endDate: end }),
      ]);
      setSummary(summaryData);
      setPnl(pnlData);
      setPayout(payoutData);
      setFees(feeData);
      setTimeline(timelineData);
      setLedger(ledgerData);
      setInvoices(invoiceData);
      setSyncStatus(syncStatusData);
      setDiscounts(discountsData);
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      if (error?.message?.includes('403') || error?.status === 403) {
        showToast(t('financials.noPermission'), 'error');
      } else {
        showToast(t('financials.loadFailed'), 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, shopIds, start, end, period, ledgerPage, ledgerFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Sync trigger ──
  const handleSync = async (forceFull = false) => {
    setSyncing(true);
    try {
      await financialsApi.triggerSync(shopId, forceFull);
      showToast(t('financials.syncStarted'), 'success');
      setTimeout(() => fetchAll(true), forceFull ? 90000 : 5000);
    } catch {
      showToast(t('financials.syncFailed'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  // ── Invoice upload handler ──
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const metadata: Record<string, string> = {};
      if (shopId) metadata.shop_id = String(shopId);
      await invoicesApi.upload(file, metadata);
      showToast(t('financials.invoiceUploaded'), 'success');
      setShowInvoiceUpload(false);
      fetchAll();
    } catch {
      showToast(t('financials.invoiceUploadFailed'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleInvoiceAction = async (invoiceId: number, action: 'approved' | 'rejected') => {
    try {
      await invoicesApi.update(invoiceId, { status: action });
      showToast(t('financials.invoiceActioned').replace('{action}', action), 'success');
      fetchAll();
    } catch {
      showToast(t('financials.invoiceActionFailed').replace('{action}', action), 'error');
    }
  };

  const handleInvoiceDelete = async (invoiceId: number) => {
    try {
      await invoicesApi.delete(invoiceId);
      showToast(t('financials.invoiceDeleted'), 'success');
      fetchAll();
    } catch {
      showToast(t('financials.invoiceDeleteFailed'), 'error');
    }
  };

  // ── Loading skeleton ──
  if (loading && !summary) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Fetch failed: show retry ──
  if (!loading && !summary) {
    return (
      <DashboardLayout>
        <div className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-600 p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-500 dark:text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">{t('financials.loadFailed')}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-4">Check that you have a connected shop and billing scope.</p>
          <button
            onClick={() => fetchAll(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 dark:bg-slate-500 dark:hover:bg-slate-400"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.retry') || 'Retry'}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Compute helpers
  const maxFee = fees ? Math.max(...fees.categories.map((c) => c.amount), 1) : 1;

  // Timeline max for bar chart scaling
  const maxTimelineVal = timeline
    ? Math.max(...timeline.timeline.map((t) => Math.max(t.revenue, t.expenses)), 1)
    : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <DisconnectedShopBanner />
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('financials.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('financials.subtitle')}{' '}
              {shopIds && shopIds.length > 1 ? `${shopIds.length} ${t('financials.selectedShops')}` : selectedShop?.display_name || t('financials.allShops')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Period dropdown (Etsy-style) */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="rounded-lg border dark:border-gray-700 px-4 py-2 text-sm bg-white dark:bg-gray-800 min-w-[240px]"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {periodToLabel(p)}
                </option>
              ))}
            </select>

            {/* Compare button (visible when multiple shops selected) */}
            {shopIds && shopIds.length > 1 && (
              <button
                onClick={async () => {
                  setShowComparison(!showComparison);
                  if (!showComparison && !comparisonData) {
                    setLoadingComparison(true);
                    try {
                      const data = await financialsApi.getComparison(shopIds, start, end);
                      setComparisonData(data.shops);
                    } catch {
                      setComparisonData(null);
                    } finally {
                      setLoadingComparison(false);
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {showComparison ? t('financials.hideComparison') : t('financials.compareShops')}
              </button>
            )}

            {/* Sync status and last updated */}
            {syncStatus && Object.keys(syncStatus.shops).length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {(() => {
                  const timestamps = Object.values(syncStatus.shops).flatMap((s) => [
                    s.ledger_last_sync_at ? new Date(s.ledger_last_sync_at).getTime() : 0,
                    s.payment_last_sync_at ? new Date(s.payment_last_sync_at).getTime() : 0,
                  ]).filter((t) => t > 0);
                  const latest = timestamps.length > 0 ? Math.max(...timestamps) : 0;
                  const hasError = Object.values(syncStatus.shops).some(
                    (s) => s.ledger_last_error || s.payment_last_error
                  );
                  return latest > 0 ? (
                    <span className={hasError ? 'text-amber-600 dark:text-amber-400' : ''}>
                      {t('financials.lastSynced')} {timeAgo(new Date(latest).toISOString())}
                    </span>
                  ) : null;
                })()}
              </span>
            )}

            {/* Sync */}
            {user?.role && ['owner', 'admin'].includes(user.role.toLowerCase()) && (
              <div className="relative">
                <button
                  onClick={() => setShowSyncMenu(!showSyncMenu)}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
                  {t('financials.sync')}
                  <ChevronDown className={cn('w-4 h-4', showSyncMenu && 'rotate-180')} />
                </button>
                {showSyncMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden="true"
                      onClick={() => setShowSyncMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border bg-white dark:bg-gray-900 shadow-lg py-1">
                      <button
                        onClick={() => { handleSync(false); setShowSyncMenu(false); }}
                        disabled={syncing}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                      >
                        {t('financials.sync')}
                      </button>
                      <button
                        onClick={() => { handleSync(true); setShowSyncMenu(false); }}
                        disabled={syncing}
                        title={t('financials.fullSyncTooltip')}
                        className="w-full px-3 py-2 text-left text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                      >
                        {t('financials.fullSync')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Unmapped ledger types warning ── */}
        {(syncStatus?.unmapped_ledger_types || summary?.warning) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t('financials.unmappedLedgerTypes')}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {t('financials.unmappedLedgerTypesMessage')}
                {(syncStatus?.unmapped_types?.length || summary?.unmapped_types?.length) ? (
                  <span className="block mt-1 font-mono text-xs">
                    {((syncStatus?.unmapped_types || summary?.unmapped_types) ?? []).slice(0, 5).join(', ')}
                    {((syncStatus?.unmapped_count ?? summary?.unmapped_count ?? 0) > 5) && ' ...'}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        )}

        {/* ── Sync error banner ── */}
        {syncStatus && Object.values(syncStatus.shops).some((s) => s.ledger_last_error || s.payment_last_error) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t('financials.syncError')}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {Object.entries(syncStatus.shops)
                  .filter(([, s]) => s.ledger_last_error || s.payment_last_error)
                  .map(([sid, s]) => (
                    <span key={sid} className="block">
                      {[s.ledger_last_error && `Ledger: ${s.ledger_last_error}`, s.payment_last_error && `Payments: ${s.payment_last_error}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ))}
              </p>
            </div>
          </div>
        )}

        {/* ── Scope warning banner ── */}
        {scopeStatus && !scopeStatus.has_billing_scope && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t('financials.billingScopeNotGranted')}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {t('financials.billingScopeMessage')}{' '}
                <code className="font-mono text-xs bg-amber-100 dark:bg-amber-800/50 px-1 rounded">{t('financials.billingScopeCode')}</code>{' '}
                {t('financials.billingScopeEnd')}
              </p>
              {scopeStatus.reconnect_url && (
                <a
                  href={scopeStatus.reconnect_url}
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline"
                >
                  {t('financials.reconnectEtsy')}
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Financial Comparison Panel ── */}
        {showComparison && shopIds && shopIds.length > 1 && (
          loadingComparison ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : comparisonData ? (
            <FinancialComparisonPanel
              comparisonData={comparisonData}
              shops={selectedShops}
              onClose={() => { setShowComparison(false); setComparisonData(null); }}
            />
          ) : null
        )}

        {/* ── Upcoming Payout (prominent card) ── */}
        {payout && payout.available_for_payout !== undefined && (
          <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Banknote className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('financials.upcomingPayout')}
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {formatWithConversion(payout.available_for_payout, payout.currency, payout.converted_available_for_payout, payout.converted_currency)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('financials.availableForPayout')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Activity Summary (Etsy-style) ── */}
        <div className="rounded-xl border bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('financials.activitySummary')}
          </h2>

          {/* Current Etsy Wallet Balance */}
          {payout && (
            <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
              {t('financials.yourCurrentBalance')}{' '}
              <strong className="text-gray-900 dark:text-gray-100">
                {formatWithConversion(payout.current_balance, payout.currency, payout.converted_current_balance, payout.converted_currency)}
              </strong>
              .
            </p>
          )}

          {/* Net Profit for selected period */}
          {summary && (
            <p className="text-base text-gray-700 dark:text-gray-300 mb-6">
              {t('financials.yourNetProfit')}{' '}
              <strong
                className={cn(
                  summary.net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {formatWithConversion(summary.net_profit, summary.currency, summary.converted_net_profit, summary.converted_currency)}
              </strong>
              .
            </p>
          )}

          {/* Sales and Fees - Expandable cards */}
          {summary && fees && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ExpandableCard
                title={t('financials.sales')}
                totalValue={formatWithConversion(summary.revenue, summary.currency, summary.converted_revenue, summary.converted_currency)}
                totalPositive
                icon={Receipt}
                defaultExpanded
              >
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('financials.totalSales')}</span>
                    <span className="font-medium">{formatWithConversion(summary.revenue, summary.currency, summary.converted_revenue, summary.converted_currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('financials.refunds')}</span>
                    <span className="font-medium text-red-600">
                      {summary.refunds > 0 ? `-${formatWithConversion(summary.refunds, summary.currency, summary.converted_refunds, summary.converted_currency)}` : '—'}
                    </span>
                  </div>
                </div>
              </ExpandableCard>

              <ExpandableCard
                title={t('financials.fees')}
                totalValue={`-${formatWithConversion(summary.etsy_fees, summary.currency, summary.converted_etsy_fees, summary.converted_currency)}`}
                totalPositive={false}
                icon={CreditCard}
                defaultExpanded
              >
                <div className="space-y-2 text-sm">
                  {fees.categories
                    .filter((c) =>
                      ['transaction_fee', 'processing_fee', 'listing_renewal', 'subscription'].includes(c.category)
                    )
                    .map((cat) => (
                      <div key={cat.category} className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{translateEntryType(cat.category)}</span>
                        <span className="font-medium text-red-600">-{formatCents(cat.amount, fees.currency)}</span>
                      </div>
                    ))}
                  {fees.categories.filter((c) =>
                    ['transaction_fee', 'processing_fee', 'listing_renewal', 'subscription'].includes(c.category)
                  ).length === 0 && (
                    <p className="text-gray-400 text-sm">{t('financials.noFeeData')}</p>
                  )}
                </div>
              </ExpandableCard>

              <ExpandableCard
                title={t('financials.marketing')}
                totalValue={`-${formatWithConversion(summary.advertising_expenses, summary.currency, summary.converted_advertising_expenses, summary.converted_currency)}`}
                totalPositive={false}
                icon={Megaphone}
                defaultExpanded
              >
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('financials.advertising')}</span>
                    <span className="font-medium text-red-600">
                      -{formatWithConversion(summary.advertising_expenses, summary.currency, summary.converted_advertising_expenses, summary.converted_currency)}
                    </span>
                  </div>
                </div>
              </ExpandableCard>

              {/* Discounts (derived from Order.discount_amt) */}
              {discounts && (discounts.total_discounts > 0 || discounts.order_count_with_discounts > 0) && (
                <ExpandableCard
                  title={t('financials.discounts')}
                  totalValue={`-${formatWithConversion(discounts.total_discounts, discounts.currency, discounts.converted_total_discounts, discounts.converted_currency)}`}
                  totalPositive={false}
                  icon={Percent}
                >
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('financials.discountsDescription')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('financials.ordersWithDiscounts')}</span>
                      <span className="font-medium">{discounts.order_count_with_discounts}</span>
                    </div>
                  </div>
                </ExpandableCard>
              )}
            </div>
          )}
        </div>

        {/* ── Additional stats (Product costs, Invoices, etc.) ── */}
        {summary && user?.role && ['owner', 'admin'].includes(user.role.toLowerCase()) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('financials.productCosts')}
              value={formatWithConversion(summary.product_costs, summary.currency, summary.converted_product_costs, summary.converted_currency)}
              icon={Package}
              positive={false}
              subtitle={t('financials.productCostsDescription')}
            />
            <StatCard
              title={t('financials.invoiceExpenses')}
              value={formatWithConversion(summary.invoice_expenses, summary.currency, summary.converted_invoice_expenses, summary.converted_currency)}
              icon={FileUp}
              positive={false}
              subtitle={t('financials.invoiceExpensesDescription')}
            />
            <StatCard
              title={t('financials.totalExpenses')}
              value={formatWithConversion(summary.total_expenses, summary.currency, summary.converted_total_expenses, summary.converted_currency)}
              icon={TrendingDown}
              positive={false}
              subtitle={t('financials.totalExpensesDescription')}
            />
            <StatCard
              title={t('financials.netProfit')}
              value={formatWithConversion(summary.net_profit, summary.currency, summary.converted_net_profit, summary.converted_currency)}
              icon={TrendingUp}
              positive={summary.net_profit >= 0}
              subtitle={summary.net_profit >= 0 ? t('financials.profitable') : t('financials.loss')}
              className={cn(
                summary.net_profit >= 0
                  ? 'border-emerald-200 dark:border-emerald-800'
                  : 'border-red-200 dark:border-red-800'
              )}
            />
          </div>
        )}

        {/* ── Invoice Expenses Section ── */}
        {user?.role && ['owner', 'admin'].includes(user.role.toLowerCase()) && (
          <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
            <SectionHeader title={t('financials.expenseInvoices')}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {invoices?.total_count ?? 0} {t('financials.invoicesCount')}
                </span>
                <label className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <FileUp className="w-4 h-4" />
                  {uploading ? t('financials.uploading') : t('financials.uploadInvoice')}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx"
                    onChange={handleInvoiceUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </SectionHeader>

            {invoices && invoices.invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                      <th className="px-4 py-2 font-medium text-gray-500">{t('financials.table.file')}</th>
                      <th className="px-4 py-2 font-medium text-gray-500">{t('financials.table.vendor')}</th>
                      <th className="px-4 py-2 font-medium text-gray-500">{t('financials.table.date')}</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-right">{t('financials.table.amount')}</th>
                      <th className="px-4 py-2 font-medium text-gray-500">{t('financials.table.status')}</th>
                      <th className="px-4 py-2 font-medium text-gray-500">{t('financials.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800">
                    {invoices.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2 truncate max-w-[200px]">
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mr-1 uppercase">
                            {inv.file_type}
                          </span>
                          {inv.file_name}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {inv.vendor_name || '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {shortDate(inv.invoice_date)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {inv.total_amount !== null ? formatCents(inv.total_amount, inv.currency) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            inv.status === 'approved' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                            inv.status === 'rejected' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
                            inv.status === 'pending' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                          )}>
                            {inv.status === 'approved' ? t('financials.status.approved') : inv.status === 'rejected' ? t('financials.status.rejected') : t('financials.status.pending')}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            {inv.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleInvoiceAction(inv.id, 'approved')}
                                  className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300"
                                >
                                  {t('common.approve')}
                                </button>
                                <button
                                  onClick={() => handleInvoiceAction(inv.id, 'rejected')}
                                  className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                                >
                                  {t('common.reject')}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleInvoiceDelete(inv.id)}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                {t('financials.noInvoices')}
              </p>
            )}
          </div>
        )}

        {/* ── Payout bar ── */}
        {payout && (
          <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
            <SectionHeader title={t('financials.payoutEstimate')}>
              <span className="text-xs text-gray-400">
                {t('financials.asOf')} {shortDate(payout.as_of)}
              </span>
            </SectionHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">{t('financials.currentBalance')}</p>
                <p className="text-xl font-bold mt-1">
                  {formatWithConversion(payout.current_balance, payout.currency, payout.converted_current_balance, payout.converted_currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('financials.reserveHeld')}</p>
                <p className="text-xl font-bold mt-1 text-amber-600">
                  {formatWithConversion(payout.reserve_held, payout.currency, payout.converted_reserve_held, payout.converted_currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('financials.availableForPayout')}</p>
                <p className="text-xl font-bold mt-1 text-emerald-600">
                  {formatWithConversion(payout.available_for_payout, payout.currency, payout.converted_available_for_payout, payout.converted_currency)}
                </p>
              </div>
            </div>

            {/* Recent payouts */}
            {payout.recent_payouts.length > 0 && (
              <div className="mt-4 pt-4 border-t dark:border-gray-800">
                <p className="text-xs font-medium text-gray-500 mb-2">{t('financials.recentPayouts')}</p>
                <div className="flex flex-wrap gap-2">
                  {payout.recent_payouts.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs text-blue-700 dark:text-blue-300"
                    >
                      <Banknote className="w-3 h-3" />
                      {formatCents(p.amount)} — {shortDate(p.date)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Two-column: Fee Breakdown + Timeline ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee breakdown */}
          {fees && (
            <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
              <SectionHeader title={t('financials.feeBreakdown')}>
                <span className="text-sm font-semibold text-gray-500">
                  {formatWithConversion(fees.total_fees, fees.currency, fees.converted_total_fees, fees.converted_currency)}
                </span>
              </SectionHeader>

              <div className="space-y-3">
                {fees.categories.map((cat) => {
                  const pct = (cat.amount / fees.total_fees) * 100;
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          {feeIcon(cat.category)}
                          {translateEntryType(cat.category)}
                        </span>
                        <span className="font-medium">{formatWithConversion(cat.amount, fees.currency, undefined, fees.converted_currency)}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {cat.count} {t('financials.entries')} &middot; {pct.toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
                {fees.categories.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {t('financials.noFeeData')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Revenue timeline (simple bar chart) */}
          {timeline && (
            <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
              <SectionHeader title={t('financials.revenueTimeline')}>
                <span className="text-xs text-gray-400 capitalize">{timeline.granularity}</span>
              </SectionHeader>

              {timeline.timeline.length > 0 ? (
                <div className="flex items-end gap-1 h-48 mt-2">
                  {timeline.timeline.map((point, idx) => {
                    const revH = (point.revenue / maxTimelineVal) * 100;
                    const expH = (point.expenses / maxTimelineVal) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-0.5 group relative"
                      >
                        {/* Tooltip */}
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                          <p>{shortDate(point.date)}</p>
                          <p className="text-emerald-400">{t('financials.rev')} {formatCents(point.revenue)}</p>
                          <p className="text-red-400">{t('financials.exp')} {formatCents(point.expenses)}</p>
                          <p className="text-blue-400">{t('financials.net')} {formatCents(point.net)}</p>
                        </div>
                        <div
                          className="w-full bg-emerald-400 dark:bg-emerald-500 rounded-t transition-all duration-300"
                          style={{ height: `${revH}%`, minHeight: point.revenue > 0 ? '2px' : 0 }}
                        />
                        <div
                          className="w-full bg-red-300 dark:bg-red-500 rounded-t transition-all duration-300"
                          style={{ height: `${expH}%`, minHeight: point.expenses > 0 ? '2px' : 0 }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-16">
                  {t('financials.noTimelineData')}
                </p>
              )}

              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> {t('financials.revenue')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-300 inline-block" /> {t('financials.expenses')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Recent activities (Ledger) ── */}
        {ledger && (
          <div className="rounded-xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="p-5 border-b dark:border-gray-800">
              <SectionHeader title={t('financials.recentActivities')}>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm rounded-lg border dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800"
                    value={ledgerFilter}
                    onChange={(e) => {
                      setLedgerFilter(e.target.value);
                      setLedgerPage(0);
                    }}
                  >
                    <option value="">{t('financials.allTypes')}</option>
                    <option value="sale">{t('financials.types.sales')}</option>
                    <option value="transaction_fee">{t('financials.types.transactionFees')}</option>
                    <option value="processing_fee">{t('financials.types.processingFees')}</option>
                    <option value="refund">{t('financials.types.refunds')}</option>
                    <option value="payout">{t('financials.types.payouts')}</option>
                    <option value="listing_renewal">{t('financials.types.listingRenewals')}</option>
                    <option value="advertising">{t('financials.types.advertising')}</option>
                    <option value="shipping_label">{t('financials.types.shippingLabels')}</option>
                    <option value="reserve">{t('financials.types.reserves')}</option>
                  </select>
                  <span className="text-xs text-gray-400">{ledger.total_count} {t('common.total')}</span>
                </div>
              </SectionHeader>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500">{t('financials.table.date')}</th>
                    <th className="px-5 py-3 font-medium text-gray-500">{t('financials.table.type')}</th>
                    <th className="px-5 py-3 font-medium text-gray-500">{t('financials.table.description')}</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">{t('financials.table.net')}</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">{t('financials.table.balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {ledger.entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {shortDate(entry.entry_created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            entryTypeBadgeClasses(entry.entry_type)
                          )}
                        >
                          {translateEntryType(entry.entry_type)}
                        </span>
                      </td>
                      <td className="px-5 py-3 max-w-xs truncate text-gray-700 dark:text-gray-300">
                        {entry.description || '—'}
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-right font-mono whitespace-nowrap',
                          entry.amount >= 0 ? 'text-emerald-600' : 'text-red-500'
                        )}
                      >
                        {entry.amount >= 0 ? '+' : ''}
                        {formatCents(entry.amount, entry.currency)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono whitespace-nowrap text-gray-500">
                        {formatCents(entry.balance, entry.currency)}
                      </td>
                    </tr>
                  ))}
                  {ledger.entries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                        {t('financials.noLedgerEntries')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {ledger.total_count > 15 && (
              <div className="flex items-center justify-between px-5 py-3 border-t dark:border-gray-800">
                <p className="text-xs text-gray-500">
                  Showing {ledger.offset + 1}–{Math.min(ledger.offset + 15, ledger.total_count)} of{' '}
                  {ledger.total_count}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={ledgerPage === 0}
                    onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={(ledgerPage + 1) * 15 >= ledger.total_count}
                    onClick={() => setLedgerPage((p) => p + 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
