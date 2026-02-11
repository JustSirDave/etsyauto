'use client';

/**
 * Supplier Dashboard
 * Minimal fulfillment-focused view: assigned orders only, no analytics/revenue
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useLanguage } from '@/lib/language-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dashboardApi, type DashboardOrder } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Package,
  Clock,
  CheckCircle,
  TruckIcon,
  AlertCircle,
  FileText,
} from 'lucide-react';

// Stat Card Component (no revenue/sensitive data)
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}

function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <div className="p-6 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-secondary)] text-sm font-medium">{title}</h3>
        <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--text-primary)]" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      </div>
      {description && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>
      )}
    </div>
  );
}

function SupplierDashboardContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [assignedOrders, setAssignedOrders] = useState<DashboardOrder[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    shipped: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Load supplier-assigned orders
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        // Fetch orders assigned to this supplier across ALL shops
        // Backend automatically filters by supplier_user_id
        // Pass undefined for shop_id to get all shops
        const ordersData = await dashboardApi.getRecentOrders(20, {});
        const orders = ordersData.orders || [];
        setAssignedOrders(orders);
        
        // Calculate stats
        const pending = orders.filter(o => 
          o.status === 'processing' || o.lifecycle_status === 'processing'
        ).length;
        const shipped = orders.filter(o => 
          o.status === 'shipped' || o.lifecycle_status === 'in_transit'
        ).length;
        
        setStats({
          pending,
          shipped,
          total: orders.length,
        });
      } catch (error: any) {
        showToast(error.detail || 'Failed to load assigned orders', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Hi, {user?.name || 'there'}. Your Assigned Orders
        </h1>
        <p className="text-[var(--text-muted)] mt-1">
          Track and fulfill orders assigned to you
        </p>
      </div>

      {/* Fulfillment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Pending Fulfillment"
          value={stats.pending}
          icon={Clock}
          description="Orders waiting to be shipped"
        />
        <StatCard
          title="In Transit"
          value={stats.shipped}
          icon={TruckIcon}
          description="Orders shipped and in transit"
        />
        <StatCard
          title="Total Assigned"
          value={stats.total}
          icon={Package}
          description="All orders assigned to you"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/orders?status=processing" className="flex items-center gap-4 p-4 rounded-xl border bg-[var(--primary)] hover:bg-[var(--primary)]/80 border-transparent text-white transition-all">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">View Pending Orders</p>
              <p className="text-xs opacity-90">Orders needing fulfillment</p>
            </div>
          </Link>
          <Link href="/orders?status=in_transit" className="flex items-center gap-4 p-4 rounded-xl border bg-[var(--card-bg)] hover:bg-[var(--card-hover)] border-[var(--border-color)] text-[var(--text-primary)] transition-all">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--primary-bg)]">
              <TruckIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">Track Shipped Orders</p>
              <p className="text-xs text-[var(--text-secondary)]">View orders in transit</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Assigned Orders List */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Your Assigned Orders
          </h2>
          <Link
            href="/orders"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            View All
          </Link>
        </div>
        {assignedOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">
              No orders assigned to you yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedOrders.map((order) => {
              const isPending = order.status === 'processing' || order.lifecycle_status === 'processing';
              const isShipped = order.status === 'shipped' || order.lifecycle_status === 'in_transit';

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border-color)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Link href={`/orders/${order.id}`} className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        isPending ? "bg-yellow-500/10" : isShipped ? "bg-blue-500/10" : "bg-green-500/10"
                      )}>
                        {isPending ? (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        ) : isShipped ? (
                          <TruckIcon className="w-5 h-5 text-blue-600" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)]">
                          {order.order_id}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {order.buyer_name}
                        </p>
                        {order.item_title && (
                          <p className="text-xs text-[var(--text-muted)] truncate mt-1">
                            {order.item_title}
                          </p>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={cn(
                        "inline-block text-xs px-2 py-1 rounded-full font-medium",
                        isPending 
                          ? "bg-yellow-500/10 text-yellow-700"
                          : isShipped
                          ? "bg-blue-500/10 text-blue-700"
                          : "bg-green-500/10 text-green-700"
                      )}>
                        {isPending ? 'Pending' : isShipped ? 'Shipped' : 'Completed'}
                      </span>
                      {isPending && (
                        <Link
                          href={`/orders/${order.id}`}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition whitespace-nowrap"
                        >
                          Fulfill
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">
              Fulfillment Guidelines
            </h3>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              <li>• Click &quot;Fulfill&quot; on pending orders to add tracking and sync to Etsy</li>
              <li>• Include carrier name and tracking code for all shipments</li>
              <li>• Use &quot;Record manually&quot; option if you don&apos;t want to sync to Etsy</li>
              <li>• Mark orders as shipped within 2 business days</li>
              <li>• Contact admin if you encounter any fulfillment issues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierDashboardPage() {
  return (
    <DashboardLayout>
      <SupplierDashboardContent />
    </DashboardLayout>
  );
}
