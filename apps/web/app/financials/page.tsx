'use client';

/**
 * Financial Analytics Page
 * Displays P&L summary, payout estimate, fee breakdown chart,
 * revenue timeline, and a searchable ledger table.
 *
 * Owner / Admin / Viewer only (via require_revenue_access on backend).
 */

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { useToast } from '@/lib/toast-context';
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

/** Pretty entry type label */
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

function periodToDates(p: Period): { start: string; end: string } {
  const end = new Date().toISOString();
  const days: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  return { start: daysAgo(days[p]), end };
}

function periodToGranularity(p: Period): string {
  if (p === '7d') return 'daily';
  if (p === '30d') return 'daily';
  if (p === '90d') return 'weekly';
  return 'monthly';
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
  const entries = Object.entries(comparisonData);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Financial Comparison</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          Close
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
                  <p className="text-gray-500 text-xs">Revenue</p>
                  <p className="font-semibold text-green-600">${(summary.revenue / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Expenses</p>
                  <p className="font-semibold text-red-500">${(summary.total_expenses / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Net Profit</p>
                  <p className="font-semibold text-blue-600">${(summary.net_profit / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Etsy Fees</p>
                  <p className="font-semibold">${(summary.etsy_fees / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Advertising</p>
                  <p className="font-semibold">${(summary.advertising_expenses / 100).toFixed(2)}</p>
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

  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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

  const shopIds = selectedShopIds && selectedShopIds.length > 0 ? selectedShopIds : undefined;
  const shopId = !shopIds ? selectedShop?.id : undefined;
  const { start, end } = periodToDates(period);

  // ── Check scope status ──
  useEffect(() => {
    financialsApi.getScopeStatus(shopId).then(setScopeStatus).catch(() => {});
  }, [shopId]);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, pnlData, payoutData, feeData, timelineData, ledgerData, invoiceData] = await Promise.all([
        financialsApi.getSummary({ shopIds, shopId, startDate: start, endDate: end }),
        financialsApi.getProfitAndLoss(shopId, start, end, shopIds),
        financialsApi.getPayoutEstimate(shopId, shopIds),
        financialsApi.getFeeBreakdown(shopId, start, end, shopIds),
        financialsApi.getTimeline(shopId, start, end, periodToGranularity(period), shopIds),
        financialsApi.getLedger(shopId, ledgerFilter || undefined, start, end, 15, ledgerPage * 15, shopIds),
        invoicesApi.list({ shopIds, shopId, limit: 10 }),
      ]);
      setSummary(summaryData);
      setPnl(pnlData);
      setPayout(payoutData);
      setFees(feeData);
      setTimeline(timelineData);
      setLedger(ledgerData);
      setInvoices(invoiceData);
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      if (error?.message?.includes('403') || error?.status === 403) {
        showToast('You do not have permission to view financial data.', 'error');
      } else {
        showToast('Failed to load financial data.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, shopIds, start, end, period, ledgerPage, ledgerFilter, showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Sync trigger ──
  const handleSync = async () => {
    setSyncing(true);
    try {
      await financialsApi.triggerSync(shopId);
      showToast('Financial sync started. Data will refresh shortly.', 'success');
      setTimeout(fetchAll, 5000);
    } catch {
      showToast('Failed to trigger sync.', 'error');
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
      showToast('Invoice uploaded successfully.', 'success');
      setShowInvoiceUpload(false);
      fetchAll();
    } catch {
      showToast('Failed to upload invoice.', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleInvoiceAction = async (invoiceId: number, action: 'approved' | 'rejected') => {
    try {
      await invoicesApi.update(invoiceId, { status: action });
      showToast(`Invoice ${action}.`, 'success');
      fetchAll();
    } catch {
      showToast(`Failed to ${action} invoice.`, 'error');
    }
  };

  const handleInvoiceDelete = async (invoiceId: number) => {
    try {
      await invoicesApi.delete(invoiceId);
      showToast('Invoice deleted.', 'success');
      fetchAll();
    } catch {
      showToast('Failed to delete invoice.', 'error');
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
            <h1 className="text-2xl font-bold tracking-tight">Financial Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Revenue, expenses, payouts, and ledger for{' '}
              {shopIds && shopIds.length > 1 ? `${shopIds.length} selected shops` : selectedShop?.display_name || 'all shops'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex rounded-lg border dark:border-gray-700 overflow-hidden text-sm">
              {(['7d', '30d', '90d', '12m'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1.5 transition-colors',
                    period === p
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {p === '12m' ? '1Y' : p.toUpperCase()}
                </button>
              ))}
            </div>

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
                {showComparison ? 'Hide Comparison' : 'Compare Shops'}
              </button>
            )}

            {/* Sync */}
            {user?.role && ['owner', 'admin'].includes(user.role.toLowerCase()) && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
                Sync
              </button>
            )}
          </div>
        </div>

        {/* ── Scope warning banner ── */}
        {scopeStatus && !scopeStatus.has_billing_scope && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Billing scope not granted
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Your shop&apos;s Etsy connection doesn&apos;t include the <code className="font-mono text-xs bg-amber-100 dark:bg-amber-800/50 px-1 rounded">billing_r</code> permission.
                Ledger and fee data won&apos;t sync until the scope is authorized.
                Order-based analytics still work normally.
              </p>
              {scopeStatus.reconnect_url && (
                <a
                  href={scopeStatus.reconnect_url}
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline"
                >
                  Reconnect Etsy to grant permission
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

        {/* ── Financial Summary: Revenue → Fees → Ads → Product Costs → Invoices → Net Profit ── */}
        {summary && (
          <>
            {/* Top KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Revenue"
                value={formatCents(summary.revenue, summary.currency)}
                icon={DollarSign}
                subtitle={`${shortDate(summary.period_start)} – ${shortDate(summary.period_end)}`}
              />
              <StatCard
                title="Etsy Fees"
                value={formatCents(summary.etsy_fees, summary.currency)}
                icon={Receipt}
                positive={false}
                subtitle="Transaction + processing + renewal"
              />
              <StatCard
                title="Advertising"
                value={formatCents(summary.advertising_expenses, summary.currency)}
                icon={Megaphone}
                positive={false}
                subtitle="Etsy Ads spend"
              />
              <StatCard
                title="Refunds"
                value={formatCents(summary.refunds, summary.currency)}
                icon={RotateCcw}
                positive={summary.refunds === 0 ? true : false}
                subtitle={summary.refunds === 0 ? 'No refunds' : 'Refunded'}
              />
            </div>

            {/* Cost + Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Product Costs"
                value={formatCents(summary.product_costs, summary.currency)}
                icon={Package}
                positive={false}
                subtitle="From product cost data"
              />
              <StatCard
                title="Invoice Expenses"
                value={formatCents(summary.invoice_expenses, summary.currency)}
                icon={FileUp}
                positive={false}
                subtitle="Approved uploaded invoices"
              />
              <StatCard
                title="Total Expenses"
                value={formatCents(summary.total_expenses, summary.currency)}
                icon={TrendingDown}
                positive={false}
                subtitle="Fees + ads + costs + invoices"
              />
              <StatCard
                title="Net Profit"
                value={formatCents(summary.net_profit, summary.currency)}
                icon={TrendingUp}
                positive={summary.net_profit >= 0}
                subtitle={summary.net_profit >= 0 ? 'Profitable' : 'Loss'}
                className={cn(
                  summary.net_profit >= 0
                    ? 'border-emerald-200 dark:border-emerald-800'
                    : 'border-red-200 dark:border-red-800'
                )}
              />
            </div>
          </>
        )}

        {/* ── Invoice Expenses Section ── */}
        {user?.role && ['owner', 'admin'].includes(user.role.toLowerCase()) && (
          <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
            <SectionHeader title="Expense Invoices">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {invoices?.total_count ?? 0} invoices
                </span>
                <label className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <FileUp className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Invoice'}
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
                      <th className="px-4 py-2 font-medium text-gray-500">File</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Vendor</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-right">Amount</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Actions</th>
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
                            {inv.status}
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
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleInvoiceAction(inv.id, 'rejected')}
                                  className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleInvoiceDelete(inv.id)}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                            >
                              Delete
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
                No invoices uploaded yet. Upload invoices to track product costs and expenses.
              </p>
            )}
          </div>
        )}

        {/* ── Payout bar ── */}
        {payout && (
          <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
            <SectionHeader title="Payout Estimate">
              <span className="text-xs text-gray-400">
                As of {shortDate(payout.as_of)}
              </span>
            </SectionHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-xl font-bold mt-1">
                  {formatCents(payout.current_balance, payout.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reserve Held</p>
                <p className="text-xl font-bold mt-1 text-amber-600">
                  {formatCents(payout.reserve_held, payout.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available for Payout</p>
                <p className="text-xl font-bold mt-1 text-emerald-600">
                  {formatCents(payout.available_for_payout, payout.currency)}
                </p>
              </div>
            </div>

            {/* Recent payouts */}
            {payout.recent_payouts.length > 0 && (
              <div className="mt-4 pt-4 border-t dark:border-gray-800">
                <p className="text-xs font-medium text-gray-500 mb-2">Recent Payouts</p>
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
              <SectionHeader title="Fee Breakdown">
                <span className="text-sm font-semibold text-gray-500">
                  {formatCents(fees.total_fees)}
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
                          {entryTypeLabel(cat.category)}
                        </span>
                        <span className="font-medium">{formatCents(cat.amount)}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {cat.count} entries &middot; {pct.toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
                {fees.categories.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">
                    No fee data for this period
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Revenue timeline (simple bar chart) */}
          {timeline && (
            <div className="rounded-xl border bg-white dark:bg-gray-900 p-5 shadow-sm">
              <SectionHeader title="Revenue Timeline">
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
                          <p className="text-emerald-400">Rev: {formatCents(point.revenue)}</p>
                          <p className="text-red-400">Exp: {formatCents(point.expenses)}</p>
                          <p className="text-blue-400">Net: {formatCents(point.net)}</p>
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
                  No timeline data for this period
                </p>
              )}

              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> Revenue
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-300 inline-block" /> Expenses
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Ledger Table ── */}
        {ledger && (
          <div className="rounded-xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="p-5 border-b dark:border-gray-800">
              <SectionHeader title="Ledger Entries">
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm rounded-lg border dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800"
                    value={ledgerFilter}
                    onChange={(e) => {
                      setLedgerFilter(e.target.value);
                      setLedgerPage(0);
                    }}
                  >
                    <option value="">All Types</option>
                    <option value="sale">Sales</option>
                    <option value="transaction_fee">Transaction Fees</option>
                    <option value="processing_fee">Processing Fees</option>
                    <option value="refund">Refunds</option>
                    <option value="payout">Payouts</option>
                    <option value="listing_renewal">Listing Renewals</option>
                    <option value="advertising">Advertising</option>
                    <option value="shipping_label">Shipping Labels</option>
                    <option value="reserve">Reserves</option>
                  </select>
                  <span className="text-xs text-gray-400">{ledger.total_count} total</span>
                </div>
              </SectionHeader>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500">Date</th>
                    <th className="px-5 py-3 font-medium text-gray-500">Type</th>
                    <th className="px-5 py-3 font-medium text-gray-500">Description</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Amount</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-right">Balance</th>
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
                          {entryTypeLabel(entry.entry_type)}
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
                        No ledger entries found for this period and filter.
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
