'use client';

/**
 * Analytics Page
 * Comprehensive analytics dashboard for Owner, Admin, and Viewer roles.
 * Pulls data from 4 backend endpoints: overview, orders, products, fulfillment.
 * Cards are clickable — opening a slide-over detail panel with the underlying data.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { useToast } from '@/lib/toast-context';
import { DisconnectedShopBanner } from '@/components/ui/DisconnectedShopBanner';
import {
  analyticsApi,
  ordersApi,
  productsApi,
  type OverviewAnalytics,
  type OrderAnalytics,
  type ProductAnalytics,
  type FulfillmentAnalytics,
  type Order,
  type Product,
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
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type DetailView =
  | { kind: 'revenue' }
  | { kind: 'orders'; statusFilter?: string }
  | { kind: 'payment'; paymentFilter?: string }
  | { kind: 'products' }
  | { kind: 'listings' }
  | { kind: 'fulfillment'; stateFilter?: string }
  | { kind: 'sources' }
  | { kind: 'suppliers' }
  | null;

/* ================================================================== */
/*  Reusable components                                                */
/* ================================================================== */

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  prefix = '',
  suffix = '',
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  prefix?: string;
  suffix?: string;
  onClick?: () => void;
}) {
  const hasTrend = trend !== undefined && trend !== null;
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-5 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] transition-all',
        onClick && 'cursor-pointer hover:shadow-lg hover:border-[var(--primary)] hover:scale-[1.02] active:scale-[0.99]',
      )}
    >
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
      {onClick && (
        <p className="text-[10px] text-[var(--text-muted)] mt-2 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Click to view details
        </p>
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
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  onClick?: () => void;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div
      onClick={onClick}
      className={cn('space-y-1.5 p-2 rounded-lg transition-all -mx-2', onClick && 'cursor-pointer hover:bg-[var(--background)]')}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-primary)]">{value.toLocaleString()}</span>
          {onClick && <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />}
        </div>
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
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg bg-[var(--background)] transition-all',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-[var(--primary)] hover:ring-opacity-50',
      )}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-secondary)] truncate">{label}</p>
        <p className="font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">{pct}%</span>
        {onClick && <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />}
      </div>
    </div>
  );
}

function ClickableCard({
  children,
  onClick,
  className: extraClass,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6 transition-all',
        onClick && 'cursor-pointer hover:shadow-lg hover:border-[var(--primary)]',
        extraClass,
      )}
    >
      {children}
    </div>
  );
}

/* ================================================================== */
/*  Detail Drawer                                                      */
/* ================================================================== */

function StatusBadge({ status, type = 'order' }: { status: string; type?: string }) {
  const colorMap: Record<string, string> = {
    processing: 'bg-yellow-100 text-yellow-700',
    in_transit: 'bg-blue-100 text-blue-700',
    shipped: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    refunded: 'bg-orange-100 text-orange-700',
    delayed: 'bg-orange-100 text-orange-700',
    paid: 'bg-emerald-100 text-emerald-700',
    unpaid: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-blue-100 text-blue-700',
    successful: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
  };

  const classes = colorMap[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', classes)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DetailDrawer({
  view,
  onClose,
  overview,
  orders,
  products,
  fulfillment,
  shopId,
  isOwner,
}: {
  view: DetailView;
  onClose: () => void;
  overview: OverviewAnalytics | null;
  orders: OrderAnalytics | null;
  products: ProductAnalytics | null;
  fulfillment: FulfillmentAnalytics | null;
  shopId?: number;
  isOwner: boolean;
}) {
  const [detailOrders, setDetailOrders] = useState<Order[]>([]);
  const [detailProducts, setDetailProducts] = useState<Product[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTotal, setDetailTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 15;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch detail data when view changes
  useEffect(() => {
    if (!view) return;
    setPage(1);
  }, [view]);

  useEffect(() => {
    if (!view) return;
    loadDetailData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, page]);

  const loadDetailData = async () => {
    if (!view) return;
    setDetailLoading(true);

    try {
      if (view.kind === 'orders') {
        const res = await ordersApi.getAll(page, limit, view.statusFilter, undefined, { shopId });
        setDetailOrders(res.orders);
        setDetailTotal(res.total);
      } else if (view.kind === 'payment') {
        const res = await ordersApi.getAll(page, limit, undefined, view.paymentFilter, { shopId });
        setDetailOrders(res.orders);
        setDetailTotal(res.total);
      } else if (view.kind === 'products') {
        const res = await productsApi.getAll(page, limit, undefined, { shopId });
        setDetailProducts(res.products);
        setDetailTotal(res.total);
      } else if (view.kind === 'fulfillment') {
        // Use orders endpoint; map fulfillment states to lifecycle_status
        const statusMap: Record<string, string> = {
          processing: 'processing',
          shipped: 'in_transit',
          in_transit: 'in_transit',
          delivered: 'completed',
          delayed: 'processing',
          cancelled: 'cancelled',
        };
        const mappedStatus = view.stateFilter ? statusMap[view.stateFilter] || undefined : undefined;
        const res = await ordersApi.getAll(page, limit, mappedStatus, undefined, { shopId });
        setDetailOrders(res.orders);
        setDetailTotal(res.total);
      }
    } catch {
      // silently handle
    } finally {
      setDetailLoading(false);
    }
  };

  if (!view) return null;

  const totalPages = Math.ceil(detailTotal / limit);

  const getTitle = (): string => {
    switch (view.kind) {
      case 'revenue': return 'Revenue Breakdown';
      case 'orders': return view.statusFilter ? `Orders — ${view.statusFilter.replace(/_/g, ' ')}` : 'All Orders';
      case 'payment': return view.paymentFilter ? `Orders — ${view.paymentFilter}` : 'Payment Overview';
      case 'products': return 'All Products';
      case 'listings': return 'Listing Jobs';
      case 'fulfillment': return view.stateFilter ? `Fulfillment — ${view.stateFilter.replace(/_/g, ' ')}` : 'Fulfillment Overview';
      case 'sources': return 'Shipment Sources';
      case 'suppliers': return 'Supplier Performance';
      default: return 'Details';
    }
  };

  const renderContent = () => {
    /* ── Revenue detail ────────────────────────── */
    if (view.kind === 'revenue' && overview) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Total Revenue" value={`$${overview.total_revenue.toFixed(2)}`} />
            <StatTile label="Avg Order Value" value={`$${overview.avg_order_value.toFixed(2)}`} />
            <StatTile label="Total Orders" value={overview.total_orders.toLocaleString()} />
          </div>

          <div className="border-t border-[var(--border-color)] pt-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">7-Day Performance</h4>
            <div className="grid grid-cols-2 gap-4">
              <TrendTile label="Orders" value={overview.orders_7d} trend={overview.orders_7d_trend} />
              <TrendTile label="Revenue" value={`$${overview.revenue_7d.toFixed(2)}`} trend={overview.revenue_7d_trend} />
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">30-Day Performance</h4>
            <div className="grid grid-cols-2 gap-4">
              <TrendTile label="Orders" value={overview.orders_30d} trend={overview.orders_30d_trend} />
              <TrendTile label="Revenue" value={`$${overview.revenue_30d.toFixed(2)}`} trend={overview.revenue_30d_trend} />
            </div>
          </div>

          {overview.orders_30d > 0 && (
            <div className="border-t border-[var(--border-color)] pt-4">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Insights</h4>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>Daily avg (30d): <strong className="text-[var(--text-primary)]">${(overview.revenue_30d / 30).toFixed(2)}</strong> revenue, <strong className="text-[var(--text-primary)]">{(overview.orders_30d / 30).toFixed(1)}</strong> orders</p>
                <p>Daily avg (7d): <strong className="text-[var(--text-primary)]">${(overview.revenue_7d / 7).toFixed(2)}</strong> revenue, <strong className="text-[var(--text-primary)]">{(overview.orders_7d / 7).toFixed(1)}</strong> orders</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    /* ── Orders list ───────────────────────────── */
    if ((view.kind === 'orders' || view.kind === 'payment' || view.kind === 'fulfillment') && !detailLoading) {
      if (detailOrders.length === 0) {
        return <EmptyState message="No orders found for this filter." />;
      }
      return (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">{detailTotal} order{detailTotal !== 1 ? 's' : ''} total</p>
          <div className="space-y-2">
            {detailOrders.map((order) => (
              <a
                key={order.id}
                href={`/orders/${order.id}`}
                className="block p-4 rounded-lg bg-[var(--background)] hover:ring-2 hover:ring-[var(--primary)] hover:ring-opacity-50 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {order.order_id}
                  </span>
                  <StatusBadge status={order.lifecycle_status || order.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>{order.buyer_name}</span>
                  <span>{order.total_price != null ? `$${(order.total_price / 100).toFixed(2)}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-1">
                  <span>{order.item_title || '—'}</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <StatusBadge status={order.payment_status} />
                  {order.fulfillment_status && <StatusBadge status={order.fulfillment_status} />}
                </div>
              </a>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      );
    }

    /* ── Products list ─────────────────────────── */
    if (view.kind === 'products' && !detailLoading) {
      if (detailProducts.length === 0) {
        return <EmptyState message="No products found." />;
      }
      return (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">{detailTotal} product{detailTotal !== 1 ? 's' : ''} total</p>
          <div className="space-y-2">
            {detailProducts.map((product) => (
              <a
                key={product.id}
                href={`/products/${product.id}`}
                className="flex items-center gap-3 p-4 rounded-lg bg-[var(--background)] hover:ring-2 hover:ring-[var(--primary)] hover:ring-opacity-50 transition-all"
              >
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.title_raw}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[var(--card-bg)] flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{product.title_raw}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {product.price != null ? `$${(product.price / 100).toFixed(2)}` : '—'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{product.source}</span>
                    {product.etsy_listing_id && (
                      <StatusBadge status="published" />
                    )}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              </a>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      );
    }

    /* ── Listing jobs detail ───────────────────── */
    if (view.kind === 'listings' && products) {
      const jobs = products.listing_jobs;
      const jTotal = jobs.total || 1;
      return (
        <div className="space-y-6">
          <StatTile label="Total Listing Jobs" value={jobs.total.toLocaleString()} />
          <div className="space-y-3">
            <ProgressRow label="Successful" value={jobs.successful} total={jTotal} color="bg-emerald-500" />
            <ProgressRow label="Pending" value={jobs.pending} total={jTotal} color="bg-blue-500" />
            <ProgressRow label="Failed" value={jobs.failed} total={jTotal} color="bg-red-500" />
          </div>
          {jobs.total > 0 && (
            <div className="border-t border-[var(--border-color)] pt-4">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Rates</h4>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-xl font-bold text-emerald-500">{((jobs.successful / jobs.total) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-[var(--text-muted)]">Success</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-500">{((jobs.failed / jobs.total) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-[var(--text-muted)]">Failure</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-500">{((jobs.pending / jobs.total) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-[var(--text-muted)]">Pending</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    /* ── Sources detail ────────────────────────── */
    if (view.kind === 'sources' && fulfillment) {
      const src = fulfillment.source_breakdown;
      const sTotal = src.manual + src.etsy_sync + src.auto || 1;
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-[var(--background)]">
              <p className="text-2xl font-bold text-violet-500">{src.manual}</p>
              <p className="text-xs text-[var(--text-muted)]">Manual</p>
            </div>
            <div className="p-4 rounded-lg bg-[var(--background)]">
              <p className="text-2xl font-bold text-blue-500">{src.etsy_sync}</p>
              <p className="text-xs text-[var(--text-muted)]">Etsy Sync</p>
            </div>
            <div className="p-4 rounded-lg bg-[var(--background)]">
              <p className="text-2xl font-bold text-emerald-500">{src.auto}</p>
              <p className="text-xs text-[var(--text-muted)]">Automatic</p>
            </div>
          </div>
          <ProgressRow label="Manual" value={src.manual} total={sTotal} color="bg-violet-500" />
          <ProgressRow label="Etsy Sync" value={src.etsy_sync} total={sTotal} color="bg-blue-500" />
          <ProgressRow label="Automatic" value={src.auto} total={sTotal} color="bg-emerald-500" />
        </div>
      );
    }

    /* ── Supplier performance detail ───────────── */
    if (view.kind === 'suppliers' && fulfillment && isOwner) {
      const entries = Object.entries(fulfillment.supplier_performance);
      if (entries.length === 0) return <EmptyState message="No supplier performance data yet." />;
      const maxShipments = Math.max(...entries.map(([, d]) => d.shipment_count), 1);
      return (
        <div className="space-y-4">
          {entries
            .sort(([, a], [, b]) => b.shipment_count - a.shipment_count)
            .map(([supplierId, data]) => (
              <div key={supplierId} className="p-4 rounded-lg bg-[var(--background)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Supplier #{supplierId}</span>
                  <span className="text-sm font-bold text-[var(--primary)]">{data.shipment_count} shipments</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--card-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                    style={{ width: `${(data.shipment_count / maxShipments) * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      );
    }

    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      );
    }

    return <EmptyState message="No data available." />;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--card-bg)] shadow-2xl z-50 flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)] capitalize">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--background)] transition"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </>
  );
}

/* ── Small helper components for the drawer ──────────────────── */

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-lg bg-[var(--background)] text-center">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function TrendTile({ label, value, trend }: { label: string; value: string | number; trend: number }) {
  const positive = trend >= 0;
  return (
    <div className="p-4 rounded-lg bg-[var(--background)]">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className="text-lg font-bold text-[var(--text-primary)]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <div className="flex items-center gap-1 mt-1">
        {positive ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
        <span className={cn('text-xs font-semibold', positive ? 'text-emerald-500' : 'text-red-500')}>
          {positive ? '+' : ''}{trend.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-semibold text-[var(--text-primary)]">{value} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--background)] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--background)] transition disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" /> Previous
      </button>
      <span className="text-sm text-[var(--text-muted)]">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--background)] transition disabled:opacity-40"
      >
        Next <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="w-12 h-12 text-[var(--text-muted)] mb-3" />
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

/* ================================================================== */
/*  Main page                                                          */
/* ================================================================== */

function ShopComparisonPanel({
  comparisonData,
  shops,
  onClose,
}: {
  comparisonData: Record<string, { overview: OverviewAnalytics; orders: OrderAnalytics }>;
  shops: { id: number; display_name: string }[];
  onClose: () => void;
}) {
  const shopEntries = Object.entries(comparisonData);

  return (
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Shop Comparison</h3>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">
          Close
        </button>
      </div>

      <div className={`grid gap-4 ${shopEntries.length === 2 ? 'grid-cols-2' : shopEntries.length >= 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {shopEntries.map(([shopId, data]) => {
          const shop = shops.find((s) => s.id === Number(shopId));
          const shopName = shop?.display_name || `Shop ${shopId}`;
          return (
            <div key={shopId} className="bg-[var(--background)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
              <h4 className="font-semibold text-[var(--text-primary)] text-sm border-b border-[var(--border-color)] pb-2">
                {shopName}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Revenue</p>
                  <p className="text-[var(--text-primary)] font-semibold">${data.overview.total_revenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Orders</p>
                  <p className="text-[var(--text-primary)] font-semibold">{data.overview.total_orders}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Avg Order</p>
                  <p className="text-[var(--text-primary)] font-semibold">${data.overview.avg_order_value.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Rev (30d)</p>
                  <p className="text-[var(--text-primary)] font-semibold">${data.overview.revenue_30d.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Orders (7d)</p>
                  <p className="text-[var(--text-primary)] font-semibold">{data.overview.orders_7d}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Orders (30d)</p>
                  <p className="text-[var(--text-primary)] font-semibold">{data.overview.orders_30d}</p>
                </div>
              </div>
              <div className="text-xs space-y-1 pt-2 border-t border-[var(--border-color)]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Processing</span>
                  <span className="text-yellow-400">{data.orders.status_breakdown.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">In Transit</span>
                  <span className="text-blue-400">{data.orders.status_breakdown.in_transit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Completed</span>
                  <span className="text-green-400">{data.orders.status_breakdown.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Cancelled</span>
                  <span className="text-red-400">{data.orders.status_breakdown.cancelled}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsContent() {
  const { user } = useAuth();
  const { selectedShop, selectedShopIds, selectedShops } = useShop();
  const { showToast } = useToast();

  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [orders, setOrders] = useState<OrderAnalytics | null>(null);
  const [products, setProducts] = useState<ProductAnalytics | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [comparisonData, setComparisonData] = useState<Record<string, { overview: OverviewAnalytics; orders: OrderAnalytics }> | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const isOwner = user?.role?.toLowerCase() === 'owner';
  const shopIds = selectedShopIds && selectedShopIds.length > 0 ? selectedShopIds : undefined;
  const shopId = !shopIds ? selectedShop?.id : undefined;

  const loadAnalytics = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const [overviewData, ordersData, productsData, fulfillmentData] = await Promise.all([
        analyticsApi.getOverview(shopId, forceRefresh, shopIds),
        analyticsApi.getOrders(shopId, forceRefresh, shopIds),
        analyticsApi.getProducts(shopId, forceRefresh, shopIds),
        analyticsApi.getFulfillment(shopId, forceRefresh, shopIds),
      ]);

      setOverview(overviewData);
      setOrders(ordersData);
      setProducts(productsData);
      setFulfillment(fulfillmentData);
    } catch (err: unknown) {
      const error = err as { detail?: string };
      showToast(error?.detail || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId, shopIds, showToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleKpiClick = useCallback(async (detailViewValue: DetailView) => {
    setDetailView(detailViewValue);
    // If multiple shops are selected, also load comparison
    if (shopIds && shopIds.length > 1) {
      setLoadingComparison(true);
      setShowComparison(true);
      try {
        const data = await analyticsApi.getComparison(shopIds);
        setComparisonData(data.shops);
      } catch {
        setComparisonData(null);
      } finally {
        setLoadingComparison(false);
      }
    }
  }, [shopIds]);

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
      <DisconnectedShopBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="text-[var(--text-muted)] mt-1">
            Performance overview{shopIds && shopIds.length > 1 ? ` for ${shopIds.length} shops` : selectedShop ? ` for ${selectedShop.display_name}` : ''}
            <span className="ml-2 text-xs">— click any card for details</span>
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
              onClick={() => handleKpiClick({ kind: 'revenue' })}
            />
            <KpiCard
              title="Total Orders"
              value={overview.total_orders}
              icon={ShoppingCart}
              onClick={() => handleKpiClick({ kind: 'orders' })}
            />
            <KpiCard
              title="Avg Order Value"
              value={overview.avg_order_value.toFixed(2)}
              prefix="$"
              icon={BarChart3}
              onClick={() => handleKpiClick({ kind: 'revenue' })}
            />
            <KpiCard
              title="Revenue (30d)"
              value={overview.revenue_30d.toFixed(2)}
              prefix="$"
              icon={DollarSign}
              trend={overview.revenue_30d_trend}
              trendLabel="vs prev 30d"
              onClick={() => handleKpiClick({ kind: 'revenue' })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Orders (7d)"
              value={overview.orders_7d}
              icon={ShoppingCart}
              trend={overview.orders_7d_trend}
              trendLabel="vs prev 7d"
              onClick={() => handleKpiClick({ kind: 'orders' })}
            />
            <KpiCard
              title="Orders (30d)"
              value={overview.orders_30d}
              icon={ShoppingCart}
              trend={overview.orders_30d_trend}
              trendLabel="vs prev 30d"
              onClick={() => handleKpiClick({ kind: 'orders' })}
            />
            <KpiCard
              title="Revenue (7d)"
              value={overview.revenue_7d.toFixed(2)}
              prefix="$"
              icon={TrendingUp}
              trend={overview.revenue_7d_trend}
              trendLabel="vs prev 7d"
              onClick={() => handleKpiClick({ kind: 'revenue' })}
            />
            <KpiCard
              title="Revenue (30d)"
              value={overview.revenue_30d.toFixed(2)}
              prefix="$"
              icon={TrendingUp}
              trend={overview.revenue_30d_trend}
              trendLabel="vs prev 30d"
              onClick={() => handleKpiClick({ kind: 'revenue' })}
            />
          </div>
        </>
      )}

      {/* ── Shop Comparison (when multiple shops selected) ──── */}
      {showComparison && shopIds && shopIds.length > 1 && (
        loadingComparison ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
          </div>
        ) : comparisonData ? (
          <ShopComparisonPanel
            comparisonData={comparisonData}
            shops={selectedShops}
            onClose={() => { setShowComparison(false); setComparisonData(null); }}
          />
        ) : null
      )}

      {/* ── Order Status & Payment ───────────────────────────── */}
      {orders && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order status */}
          <ClickableCard>
            <SectionHeader title="Order Status" subtitle={`${orderTotal} total orders`} />
            <div className="space-y-4">
              <BarItem label="Processing" value={orders.status_breakdown.processing} total={orderTotal} color="bg-yellow-500" onClick={() => setDetailView({ kind: 'orders', statusFilter: 'processing' })} />
              <BarItem label="In Transit" value={orders.status_breakdown.in_transit} total={orderTotal} color="bg-blue-500" onClick={() => setDetailView({ kind: 'orders', statusFilter: 'in_transit' })} />
              <BarItem label="Completed" value={orders.status_breakdown.completed} total={orderTotal} color="bg-emerald-500" onClick={() => setDetailView({ kind: 'orders', statusFilter: 'completed' })} />
              <BarItem label="Cancelled" value={orders.status_breakdown.cancelled} total={orderTotal} color="bg-red-500" onClick={() => setDetailView({ kind: 'orders', statusFilter: 'cancelled' })} />
              <BarItem label="Refunded" value={orders.status_breakdown.refunded} total={orderTotal} color="bg-orange-500" onClick={() => setDetailView({ kind: 'orders', statusFilter: 'refunded' })} />
            </div>
          </ClickableCard>

          {/* Payment breakdown */}
          <ClickableCard>
            <SectionHeader title="Payment Status" subtitle={`${paymentTotal} total orders`} />
            <div className="grid grid-cols-2 gap-4 mb-6">
              <DonutStat
                label="Paid"
                value={orders.payment_breakdown.paid}
                total={paymentTotal}
                color="bg-emerald-100 text-emerald-600"
                icon={CheckCircle}
                onClick={() => setDetailView({ kind: 'payment', paymentFilter: 'paid' })}
              />
              <DonutStat
                label="Unpaid"
                value={orders.payment_breakdown.unpaid}
                total={paymentTotal}
                color="bg-amber-100 text-amber-600"
                icon={AlertTriangle}
                onClick={() => setDetailView({ kind: 'payment', paymentFilter: 'unpaid' })}
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
          </ClickableCard>
        </div>
      )}

      {/* ── Products & Listings ──────────────────────────────── */}
      {products && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product overview */}
          <ClickableCard onClick={() => setDetailView({ kind: 'products' })}>
            <SectionHeader title="Products" subtitle="Inventory overview — click to browse" />
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
          </ClickableCard>

          {/* Listing jobs */}
          <ClickableCard onClick={() => setDetailView({ kind: 'listings' })}>
            <SectionHeader title="Listing Jobs" subtitle="Publishing pipeline — click for details" />
            <div className="space-y-4">
              <BarItem label="Successful" value={products.listing_jobs.successful} total={products.listing_jobs.total} color="bg-emerald-500" />
              <BarItem label="Pending" value={products.listing_jobs.pending} total={products.listing_jobs.total} color="bg-blue-500" />
              <BarItem label="Failed" value={products.listing_jobs.failed} total={products.listing_jobs.total} color="bg-red-500" />
            </div>
            <div className="mt-4 p-3 rounded-lg bg-[var(--background)] text-center">
              <p className="text-sm text-[var(--text-muted)]">Total Jobs</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{products.listing_jobs.total}</p>
            </div>
          </ClickableCard>
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
              onClick={() => setDetailView({ kind: 'fulfillment' })}
            />
            <KpiCard
              title="Delivered"
              value={fulfillment.state_breakdown.delivered}
              icon={CheckCircle}
              onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'delivered' })}
            />
            <KpiCard
              title="In Transit"
              value={fulfillment.state_breakdown.in_transit + fulfillment.state_breakdown.shipped}
              icon={Truck}
              onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'in_transit' })}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fulfillment states */}
            <ClickableCard>
              <SectionHeader title="Fulfillment Status" subtitle={`${fulfillmentTotal} shipments`} />
              <div className="space-y-3">
                <DonutStat label="Processing" value={fulfillment.state_breakdown.processing} total={fulfillmentTotal} color="bg-yellow-100 text-yellow-600" icon={Clock} onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'processing' })} />
                <DonutStat label="Shipped" value={fulfillment.state_breakdown.shipped} total={fulfillmentTotal} color="bg-blue-100 text-blue-600" icon={Truck} onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'shipped' })} />
                <DonutStat label="In Transit" value={fulfillment.state_breakdown.in_transit} total={fulfillmentTotal} color="bg-indigo-100 text-indigo-600" icon={Truck} onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'in_transit' })} />
                <DonutStat label="Delivered" value={fulfillment.state_breakdown.delivered} total={fulfillmentTotal} color="bg-emerald-100 text-emerald-600" icon={CheckCircle} onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'delivered' })} />
                <DonutStat label="Delayed" value={fulfillment.state_breakdown.delayed} total={fulfillmentTotal} color="bg-orange-100 text-orange-600" icon={AlertTriangle} onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'delayed' })} />
                <DonutStat label="Cancelled" value={fulfillment.state_breakdown.cancelled} total={fulfillmentTotal} color="bg-red-100 text-red-600" icon={XCircle} onClick={() => setDetailView({ kind: 'fulfillment', stateFilter: 'cancelled' })} />
              </div>
            </ClickableCard>

            {/* Shipment source + supplier performance */}
            <div className="space-y-6">
              <ClickableCard onClick={() => setDetailView({ kind: 'sources' })}>
                <SectionHeader title="Shipment Source" subtitle="How shipments were created — click for details" />
                <div className="space-y-4">
                  <BarItem label="Manual" value={fulfillment.source_breakdown.manual} total={sourceTotal} color="bg-violet-500" />
                  <BarItem label="Etsy Sync" value={fulfillment.source_breakdown.etsy_sync} total={sourceTotal} color="bg-blue-500" />
                  <BarItem label="Automatic" value={fulfillment.source_breakdown.auto} total={sourceTotal} color="bg-emerald-500" />
                </div>
              </ClickableCard>

              {/* Supplier performance (owner only) */}
              {isOwner && fulfillment.supplier_performance && Object.keys(fulfillment.supplier_performance).length > 0 && (
                <ClickableCard onClick={() => setDetailView({ kind: 'suppliers' })}>
                  <SectionHeader title="Supplier Performance" subtitle="Shipments per supplier — click for details" />
                  <div className="space-y-3">
                    {Object.entries(fulfillment.supplier_performance).map(([supplierId, data]) => (
                      <div key={supplierId} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)]">
                        <span className="text-sm text-[var(--text-secondary)]">Supplier #{supplierId}</span>
                        <span className="font-semibold text-[var(--text-primary)]">{data.shipment_count} shipments</span>
                      </div>
                    ))}
                  </div>
                </ClickableCard>
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

      {/* Detail Drawer */}
      {detailView && (
        <DetailDrawer
          view={detailView}
          onClose={() => setDetailView(null)}
          overview={overview}
          orders={orders}
          products={products}
          fulfillment={fulfillment}
          shopId={shopId}
          isOwner={isOwner}
        />
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
