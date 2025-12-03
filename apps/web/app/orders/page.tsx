'use client';

/**
 * Orders Page - Vuexy Style
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SearchInput, PageSizeDropdown, ExportButton, TableActions, Pagination, TableCheckbox } from '@/components/ui/DataTable';
import { Calendar, CheckCircle, RotateCcw, XCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const mockOrders = [
  { id: '#6979', date: 'Apr 15, 2023, 10:21', customer: { name: 'Cristine Easom', email: 'ceasom@example.com', initials: 'CE' }, payment: 'pending', status: 'delivered', method: { type: 'mastercard', last4: '2356' } },
  { id: '#6624', date: 'Apr 17, 2023, 6:43', customer: { name: 'Fayre Screech', email: 'fscreech@example.com', initials: 'FS' }, payment: 'failed', status: 'delivered', method: { type: 'mastercard', last4: '2077' } },
  { id: '#9305', date: 'Apr 17, 2023, 8:05', customer: { name: 'Pauline Pfaffe', email: 'ppfaffe@example.com', initials: 'PP' }, payment: 'cancelled', status: 'out_for_delivery', method: { type: 'paypal', email: '@gmail.com' } },
  { id: '#8005', date: 'Apr 22, 2023, 3:01', customer: { name: 'Maurits Nealey', email: 'mnealey@example.com', initials: 'MN' }, payment: 'paid', status: 'dispatched', method: { type: 'mastercard', last4: '1555' } },
  { id: '#5859', date: 'Apr 29, 2023, 9:52', customer: { name: 'Eydie Vogelein', email: 'evogelein@example.com', initials: 'EV' }, payment: 'cancelled', status: 'out_for_delivery', method: { type: 'paypal', email: '@gmail.com' } },
];

const statsData = [
  { title: 'Pending Payment', value: 56, icon: <Calendar className="w-6 h-6" />, color: 'primary' },
  { title: 'Completed', value: '12,689', icon: <CheckCircle className="w-6 h-6" />, color: 'success' },
  { title: 'Refunded', value: 124, icon: <RotateCcw className="w-6 h-6" />, color: 'warning' },
  { title: 'Failed', value: 32, icon: <XCircle className="w-6 h-6" />, color: 'danger' },
];

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

function PaymentMethod({ method }: { method: { type: string; last4?: string; email?: string } }) {
  if (method.type === 'mastercard') return <div className="flex items-center gap-2"><div className="w-8 h-5 bg-gradient-to-r from-red-500 to-orange-500 rounded flex items-center justify-center"><CreditCard className="w-3 h-3 text-white" /></div><span className="text-[var(--text-muted)] text-sm">...{method.last4}</span></div>;
  if (method.type === 'paypal') return <div className="flex items-center gap-2"><div className="w-8 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold">PP</div><span className="text-[var(--text-muted)] text-sm">...{method.email}</span></div>;
  return null;
}

function CustomerAvatar({ customer }: { customer: { name: string; initials: string } }) {
  const colors = ['bg-[var(--primary)]', 'bg-[var(--success)]', 'bg-[var(--warning)]', 'bg-[var(--info)]', 'bg-[var(--danger)]'];
  const colorIndex = customer.name.charCodeAt(0) % colors.length;
  return <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium', colors[colorIndex])}>{customer.initials}</div>;
}

function OrdersContent() {
  const router = useRouter();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSelectAll = () => setSelectedOrders(selectedOrders.length === mockOrders.length ? [] : mockOrders.map(o => o.id));
  const toggleSelect = (id: string) => setSelectedOrders(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold text-[var(--text-primary)]">{stat.value}</p>
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
          <div className="flex items-center gap-3"><PageSizeDropdown value={pageSize} onChange={setPageSize} /><ExportButton /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-4 px-5 w-12"><TableCheckbox checked={selectedOrders.length === mockOrders.length} indeterminate={selectedOrders.length > 0 && selectedOrders.length < mockOrders.length} onChange={toggleSelectAll} /></th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Order</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Customers</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Payment</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Method</th>
                <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors">
                  <td className="py-4 px-5"><TableCheckbox checked={selectedOrders.includes(order.id)} onChange={() => toggleSelect(order.id)} /></td>
                  <td className="py-4 px-5"><span className="font-medium text-[var(--primary)]">{order.id}</span></td>
                  <td className="py-4 px-5 text-[var(--text-muted)] text-sm">{order.date}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar customer={order.customer} />
                      <div><p className="font-medium text-[var(--text-primary)]">{order.customer.name}</p><p className="text-sm text-[var(--text-muted)]">{order.customer.email}</p></div>
                    </div>
                  </td>
                  <td className="py-4 px-5"><PaymentStatus status={order.payment} /></td>
                  <td className="py-4 px-5"><OrderStatus status={order.status} /></td>
                  <td className="py-4 px-5"><PaymentMethod method={order.method} /></td>
                  <td className="py-4 px-5"><TableActions onView={() => router.push(`/orders/${order.id.replace('#', '')}`)} onDelete={() => console.log('Delete', order.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={10} totalItems={100} pageSize={pageSize} onPageChange={setCurrentPage} />
      </DashboardCard>
    </div>
  );
}

export default function OrdersPage() {
  return <DashboardLayout><OrdersContent /></DashboardLayout>;
}
