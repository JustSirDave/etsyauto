'use client';

/**
 * Orders Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SearchInput, PageSizeDropdown, TableActions, Pagination, TableCheckbox } from '@/components/ui/DataTable';
import { Calendar, CheckCircle, RotateCcw, XCircle, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ordersApi, Order, OrderStats } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

function PaymentStatus({ status }: { status: string }) {
  const styles: Record<string, { dot: string; text: string }> = {
    pending: { dot: 'bg-[var(--warning)]', text: 'text-[var(--warning)]' },
    paid: { dot: 'bg-[var(--success)]', text: 'text-[var(--success)]' },
    failed: { dot: 'bg-[var(--danger)]', text: 'text-[var(--danger)]' },
    cancelled: { dot: 'bg-[var(--text-muted)]', text: 'text-[var(--text-muted)]' },
  };
  const style = styles[status] || styles.pending;
  return <div className="flex items-center gap-2"><span className={cn('w-2 h-2 rounded-full', style.dot)} /><span className={cn('text-sm', style.text)}>{status.charAt(0).toUpperCase() + status.slice(1)}</span></div>;
}

function OrderStatus({ status }: { status: string }) {
  const styles: Record<string, string> = { delivered: 'bg-[var(--success-bg)] text-[var(--success)]', dispatched: 'bg-[var(--info-bg)] text-[var(--info)]', out_for_delivery: 'bg-[var(--warning-bg)] text-[var(--warning)]', pending: 'bg-[var(--primary-bg)] text-[var(--primary)]' };
  const labels: Record<string, string> = { delivered: 'Delivered', dispatched: 'Dispatched', out_for_delivery: 'Out for Delivery', pending: 'Pending' };
  return <span className={cn('inline-flex px-2.5 py-1 rounded-md text-xs font-medium', styles[status] || styles.pending)}>{labels[status] || status}</span>;
}

function CustomerAvatar({ customer }: { customer: { name: string; initials: string } }) {
  const colors = ['bg-[var(--primary)]', 'bg-[var(--success)]', 'bg-[var(--warning)]', 'bg-[var(--info)]', 'bg-[var(--danger)]'];
  const colorIndex = customer.name.charCodeAt(0) % colors.length;
  return <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium', colors[colorIndex])}>{customer.initials}</div>;
}

function OrdersContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Sync orders from Etsy
  const handleSyncOrders = async () => {
    try {
      setSyncing(true);
      showToast('Syncing orders from Etsy...', 'info');
      await ordersApi.sync();
      showToast('Orders synced successfully!', 'success');
      await loadOrders();
      await loadStats();
    } catch (error: any) {
      console.error('Failed to sync orders:', error);
      showToast(error.detail || 'Failed to sync orders', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const data = await ordersApi.getStats();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load order stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load orders
  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await ordersApi.getAll(currentPage, pageSize);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      showToast(error.detail || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [currentPage, pageSize]);

  // Filter orders by search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_id.toLowerCase().includes(query) ||
      order.buyer_name.toLowerCase().includes(query) ||
      order.buyer_email.toLowerCase().includes(query)
    );
  });

  const toggleSelectAll = () => setSelectedOrders(selectedOrders.length === filteredOrders.length ? [] : filteredOrders.map(o => o.id));
  const toggleSelect = (id: number) => setSelectedOrders(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const statsData = [
    { title: 'Pending Payment', value: stats?.pending_payment || 0, icon: <Calendar className="w-6 h-6" />, color: 'primary' },
    { title: 'Completed', value: stats?.completed || 0, icon: <CheckCircle className="w-6 h-6" />, color: 'success' },
    { title: 'Refunded', value: stats?.refunded || 0, icon: <RotateCcw className="w-6 h-6" />, color: 'warning' },
    { title: 'Failed', value: stats?.failed || 0, icon: <XCircle className="w-6 h-6" />, color: 'danger' },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                {loadingStats ? (
                  <div className="w-16 h-9 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{stat.value.toLocaleString()}</p>
                )}
                <p className="text-[var(--text-muted)] text-sm mt-1">{stat.title}</p>
              </div>
              <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', stat.color === 'primary' && 'bg-[var(--primary-bg)] text-[var(--primary)]', stat.color === 'success' && 'bg-[var(--success-bg)] text-[var(--success)]', stat.color === 'warning' && 'bg-[var(--warning-bg)] text-[var(--warning)]', stat.color === 'danger' && 'bg-[var(--danger-bg)] text-[var(--danger)]')}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <DashboardCard noPadding>
        <div className="p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[var(--border-color)]">
          <div className="w-full sm:w-80"><SearchInput placeholder="Search Order" value={searchQuery} onChange={setSearchQuery} /></div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncOrders}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCcw className={cn('w-4 h-4', syncing && 'animate-spin')} />
              <span>{syncing ? 'Syncing...' : 'Sync Orders'}</span>
            </button>
            <PageSizeDropdown value={pageSize} onChange={setPageSize} />
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-[var(--text-muted)] text-lg">No orders yet...</p>
              {searchQuery && (
                <p className="text-[var(--text-muted)] text-sm mt-2">Try adjusting your search query</p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-4 px-5 w-12"><TableCheckbox checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} indeterminate={selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length} onChange={toggleSelectAll} /></th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Order</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Customer</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Payment</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Amount</th>
                  <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors">
                    <td className="py-4 px-5"><TableCheckbox checked={selectedOrders.includes(order.id)} onChange={() => toggleSelect(order.id)} /></td>
                    <td className="py-4 px-5"><span className="font-medium text-[var(--primary)]">{order.order_id}</span></td>
                    <td className="py-4 px-5 text-[var(--text-muted)] text-sm">{formatDate(order.created_at)}</td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar customer={{ name: order.buyer_name, initials: order.buyer_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }} />
                        <div><p className="font-medium text-[var(--text-primary)]">{order.buyer_name}</p><p className="text-sm text-[var(--text-muted)]">{order.buyer_email}</p></div>
                      </div>
                    </td>
                    <td className="py-4 px-5"><PaymentStatus status={order.payment_status} /></td>
                    <td className="py-4 px-5"><OrderStatus status={order.status} /></td>
                    <td className="py-4 px-5">
                      <span className="font-medium text-[var(--text-primary)]">
                        {order.currency} {order.total_price.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-5"><TableActions onView={() => router.push(`/orders/${order.id}`)} onDelete={() => showToast('Delete functionality coming soon', 'info')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filteredOrders.length > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={total} pageSize={pageSize} onPageChange={setCurrentPage} />
        )}
      </DashboardCard>
    </div>
  );
}

export default function OrdersPage() {
  return <DashboardLayout><OrdersContent /></DashboardLayout>;
}
