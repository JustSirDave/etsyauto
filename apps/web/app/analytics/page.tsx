'use client';

/**
 * Analytics Page
 * Comprehensive analytics dashboard for Owner, Admin, and Viewer roles.
 * Pulls data from 4 backend endpoints: overview, orders, products, fulfillment.
 */

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { useToast } from '@/lib/toast-context';
import {
  analyticsApi,
  type OverviewAnalytics,
  type OrderAnalytics,
  type ProductAnalytics,
  type FulfillmentAnalytics,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Clock,
  RefreshCw,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Layers,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Reusable components                                                */
/* ------------------------------------------------------------------ */

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  prefix = '',
  suffix = '',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  prefix?: string;
  suffix?: string;
}) {
  const hasTrend = trend !== undefined && trend !== null;
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div className="p-5 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--text-secondary)]">{title}</span>
        <div className="w-9 h-9 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
          <Icon className="w-[18px] h-[18px] text-[var(--primary)]" />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </p>
      {hasTrend && (
        <div className="flex items-center gap-1.5 mt-2">
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          )}
          <span className={cn('text-xs font-semibold', isPositive ? 'text-emerald-500' : 'text-red-500')}>
            {isPositive ? '+' : ''}{trend.toFixed(1)}%
          </span>
          {trendLabel && <span className="text-xs text-[var(--text-muted)]">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

function BarItem({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-semibold text-[var(--text-primary)]">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--background)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}

function DonutStat({
  label,
  value,
  total,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ElementType;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)]">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-secondary)] truncate">{label}</p>
        <p className="font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      </div>
      <span className="text-xs font-medium text-[var(--text-muted)]">{pct}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

function AnalyticsContent() {
  const { user } = useAuth();
  const { selectedShop } = useShop();
  const { showToast } = useToast();

  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [orders, setOrders] = useState<OrderAnalytics | null>(null);
  const [products, setProducts] = useState<ProductAnalytics | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = user?.role?.toLowerCase() === 'owner';

  const loadAnalytics = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const shopId = selectedShop?.id;

      const [overviewData, ordersData, productsData, fulfillmentData] = await Promise.all([
        analyticsApi.getOverview(shopId, forceRefresh),
        analyticsApi.getOrders(shopId, forceRefresh),
        analyticsApi.getProducts(shopId, forceRefresh),
        analyticsApi.getFulfillment(shopId, forceRefresh),
      ]);

      setOverview(overviewData);
      setOrders(ordersData);
      setProducts(productsData);
      setFulfillment(fulfillmentData);
    } catch (err: any) {
      showToast(err?.detail || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedShop, showToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  const orderTotal = orders
    ? Object.values(orders.status_breakdown).reduce((a, b) => a + b, 0)
    : 0;
  const paymentTotal = orders
    ? orders.payment_breakdown.paid + orders.payment_breakdown.unpaid
    : 0;
  const fulfillmentTotal = fulfillment
    ? Object.values(fulfillment.state_breakdown).reduce((a, b) => a + b, 0)
    : 0;
  const sourceTotal = fulfillment
    ? Object.values(fulfillment.source_breakdown).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="text-[var(--text-muted)] mt-1">
            Performance overview{selectedShop ? ` for ${selectedShop.display_name}` : ''}
          </p>
        </div>
        <button
          onClick={() => loadAnalytics(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--card-hover)] transition disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Revenue & Order KPIs ─────────────────────────────── */}
      {overview && (
        <>
          <SectionHeader title="Revenue & Orders" subtitle="Key performance indicators" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Revenue"
              value={overview.total_revenue.toFixed(2)}
              prefix="$"
              icon={DollarSign}
            />
            <KpiCard
              title="Total Orders"
              value={overview.total_orders}
              icon={ShoppingCart}
            />
            <KpiCard
              title="Avg Order Value"
              value={overview.avg_order_value.toFixed(2)}
              prefix="$"
              icon={BarChart3}
            />
            <KpiCard
              title="Revenue (30d)"
              value={overview.revenue_30d.toFixed(2)}
              prefix="$"
              icon={DollarSign}
              trend={overview.revenue_30d_trend}
              trendLabel="vs prev 30d"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Orders (7d)"
              value={overview.orders_7d}
              icon={ShoppingCart}
              trend={overview.orders_7d_trend}
              trendLabel="vs prev 7d"
            />
            <KpiCard
              title="Orders (30d)"
              value={overview.orders_30d}
              icon={ShoppingCart}
              trend={overview.orders_30d_trend}
              trendLabel="vs prev 30d"
            />
            <KpiCard
              title="Revenue (7d)"
              value={overview.revenue_7d.toFixed(2)}
              prefix="$"
              icon={TrendingUp}
              trend={overview.revenue_7d_trend}
              trendLabel="vs prev 7d"
            />
            <KpiCard
              title="Revenue (30d)"
              value={overview.revenue_30d.toFixed(2)}
              prefix="$"
              icon={TrendingUp}
              trend={overview.revenue_30d_trend}
              trendLabel="vs prev 30d"
            />
          </div>
        </>
      )}

      {/* ── Order Status & Payment ───────────────────────────── */}
      {orders && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order status */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <SectionHeader title="Order Status" subtitle={`${orderTotal} total orders`} />
            <div className="space-y-4">
              <BarItem label="Processing" value={orders.status_breakdown.processing} total={orderTotal} color="bg-yellow-500" />
              <BarItem label="In Transit" value={orders.status_breakdown.in_transit} total={orderTotal} color="bg-blue-500" />
              <BarItem label="Completed" value={orders.status_breakdown.completed} total={orderTotal} color="bg-emerald-500" />
              <BarItem label="Cancelled" value={orders.status_breakdown.cancelled} total={orderTotal} color="bg-red-500" />
              <BarItem label="Refunded" value={orders.status_breakdown.refunded} total={orderTotal} color="bg-orange-500" />
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <SectionHeader title="Payment Status" subtitle={`${paymentTotal} total orders`} />
            <div className="grid grid-cols-2 gap-4 mb-6">
              <DonutStat
                label="Paid"
                value={orders.payment_breakdown.paid}
                total={paymentTotal}
                color="bg-emerald-100 text-emerald-600"
                icon={CheckCircle}
              />
              <DonutStat
                label="Unpaid"
                value={orders.payment_breakdown.unpaid}
                total={paymentTotal}
                color="bg-amber-100 text-amber-600"
                icon={AlertTriangle}
              />
            </div>

            {paymentTotal > 0 && (
              <div className="h-4 rounded-full overflow-hidden flex bg-[var(--background)]">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(orders.payment_breakdown.paid / paymentTotal) * 100}%` }}
                />
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${(orders.payment_breakdown.unpaid / paymentTotal) * 100}%` }}
                />
              </div>
            )}
            <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
              <span>Paid ({paymentTotal > 0 ? ((orders.payment_breakdown.paid / paymentTotal) * 100).toFixed(0) : 0}%)</span>
              <span>Unpaid ({paymentTotal > 0 ? ((orders.payment_breakdown.unpaid / paymentTotal) * 100).toFixed(0) : 0}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Products & Listings ──────────────────────────────── */}
      {products && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product overview */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <SectionHeader title="Products" subtitle="Inventory overview" />
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-[var(--background)]">
                <Package className="w-6 h-6 text-[var(--primary)] mx-auto mb-2" />
                <p className="text-2xl font-bold text-[var(--text-primary)]">{products.total_products}</p>
                <p className="text-xs text-[var(--text-muted)]">Total</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-[var(--background)]">
                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-[var(--text-primary)]">{products.published_products}</p>
                <p className="text-xs text-[var(--text-muted)]">Published</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-[var(--background)]">
                <FileText className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-[var(--text-primary)]">{products.draft_products}</p>
                <p className="text-xs text-[var(--text-muted)]">Drafts</p>
              </div>
            </div>

            {products.total_products > 0 && (
              <div className="h-3 rounded-full overflow-hidden flex bg-[var(--background)]">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(products.published_products / products.total_products) * 100}%` }}
                />
                <div
                  className="bg-yellow-400 transition-all duration-500"
                  style={{ width: `${(products.draft_products / products.total_products) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Listing jobs */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
            <SectionHeader title="Listing Jobs" subtitle="Publishing pipeline" />
            <div className="space-y-4">
              <BarItem label="Successful" value={products.listing_jobs.successful} total={products.listing_jobs.total} color="bg-emerald-500" />
              <BarItem label="Pending" value={products.listing_jobs.pending} total={products.listing_jobs.total} color="bg-blue-500" />
              <BarItem label="Failed" value={products.listing_jobs.failed} total={products.listing_jobs.total} color="bg-red-500" />
            </div>
            <div className="mt-4 p-3 rounded-lg bg-[var(--background)] text-center">
              <p className="text-sm text-[var(--text-muted)]">Total Jobs</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{products.listing_jobs.total}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Fulfillment ──────────────────────────────────────── */}
      {fulfillment && (
        <>
          <SectionHeader title="Fulfillment" subtitle="Shipping and delivery performance" />

          {/* Fulfillment KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="Avg Fulfillment Time"
              value={fulfillment.avg_fulfillment_time_hours > 0 ? fulfillment.avg_fulfillment_time_hours.toFixed(1) : '—'}
              suffix={fulfillment.avg_fulfillment_time_hours > 0 ? 'h' : ''}
              icon={Timer}
            />
            <KpiCard
              title="Delivered"
              value={fulfillment.state_breakdown.delivered}
              icon={CheckCircle}
            />
            <KpiCard
              title="In Transit"
              value={fulfillment.state_breakdown.in_transit + fulfillment.state_breakdown.shipped}
              icon={Truck}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fulfillment states */}
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
              <SectionHeader title="Fulfillment Status" subtitle={`${fulfillmentTotal} shipments`} />
              <div className="space-y-3">
                <DonutStat label="Processing" value={fulfillment.state_breakdown.processing} total={fulfillmentTotal} color="bg-yellow-100 text-yellow-600" icon={Clock} />
                <DonutStat label="Shipped" value={fulfillment.state_breakdown.shipped} total={fulfillmentTotal} color="bg-blue-100 text-blue-600" icon={Truck} />
                <DonutStat label="In Transit" value={fulfillment.state_breakdown.in_transit} total={fulfillmentTotal} color="bg-indigo-100 text-indigo-600" icon={Truck} />
                <DonutStat label="Delivered" value={fulfillment.state_breakdown.delivered} total={fulfillmentTotal} color="bg-emerald-100 text-emerald-600" icon={CheckCircle} />
                <DonutStat label="Delayed" value={fulfillment.state_breakdown.delayed} total={fulfillmentTotal} color="bg-orange-100 text-orange-600" icon={AlertTriangle} />
                <DonutStat label="Cancelled" value={fulfillment.state_breakdown.cancelled} total={fulfillmentTotal} color="bg-red-100 text-red-600" icon={XCircle} />
              </div>
            </div>

            {/* Shipment source + supplier performance */}
            <div className="space-y-6">
              <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
                <SectionHeader title="Shipment Source" subtitle="How shipments were created" />
                <div className="space-y-4">
                  <BarItem label="Manual" value={fulfillment.source_breakdown.manual} total={sourceTotal} color="bg-violet-500" />
                  <BarItem label="Etsy Sync" value={fulfillment.source_breakdown.etsy_sync} total={sourceTotal} color="bg-blue-500" />
                  <BarItem label="Automatic" value={fulfillment.source_breakdown.auto} total={sourceTotal} color="bg-emerald-500" />
                </div>
              </div>

              {/* Supplier performance (owner only) */}
              {isOwner && fulfillment.supplier_performance && Object.keys(fulfillment.supplier_performance).length > 0 && (
                <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
                  <SectionHeader title="Supplier Performance" subtitle="Shipments per supplier" />
                  <div className="space-y-3">
                    {Object.entries(fulfillment.supplier_performance).map(([supplierId, data]) => (
                      <div key={supplierId} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)]">
                        <span className="text-sm text-[var(--text-secondary)]">Supplier #{supplierId}</span>
                        <span className="font-semibold text-[var(--text-primary)]">{data.shipment_count} shipments</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Cache timestamp */}
      {overview?.computed_at && (
        <p className="text-xs text-[var(--text-muted)] text-right">
          Data cached at {new Date(overview.computed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <AnalyticsContent />
    </DashboardLayout>
  );
}
