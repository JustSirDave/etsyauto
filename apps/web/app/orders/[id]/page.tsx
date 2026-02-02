'use client';

/**
 * Order Detail Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ArrowLeft, Package, Calendar, User, MapPin, CreditCard, RefreshCcw } from 'lucide-react';
import { ordersApi, OrderDetail } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { useShop } from '@/lib/shop-context';

function PaymentStatus({ status }: { status: string }) {
  const styles: Record<string, { dot: string; text: string; bg: string }> = {
    pending: { dot: 'bg-[var(--warning)]', text: 'text-[var(--warning)]', bg: 'bg-[var(--warning-bg)]' },
    paid: { dot: 'bg-[var(--success)]', text: 'text-[var(--success)]', bg: 'bg-[var(--success-bg)]' },
    failed: { dot: 'bg-[var(--danger)]', text: 'text-[var(--danger)]', bg: 'bg-[var(--danger-bg)]' },
    refunded: { dot: 'bg-[var(--info)]', text: 'text-[var(--info)]', bg: 'bg-[var(--info-bg)]' },
    cancelled: { dot: 'bg-[var(--text-muted)]', text: 'text-[var(--text-muted)]', bg: 'bg-[var(--background)]' },
  };
  const style = styles[status] || styles.pending;
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full', style.bg)}>
      <span className={cn('w-2 h-2 rounded-full', style.dot)} />
      <span className={cn('text-sm font-medium', style.text)}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}

function OrderStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    delivered: 'bg-[var(--success-bg)] text-[var(--success)]',
    dispatched: 'bg-[var(--info-bg)] text-[var(--info)]',
    out_for_delivery: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    pending: 'bg-[var(--primary-bg)] text-[var(--primary)]',
    completed: 'bg-[var(--success-bg)] text-[var(--success)]',
  };
  const labels: Record<string, string> = {
    delivered: 'Delivered',
    dispatched: 'Dispatched',
    out_for_delivery: 'Out for Delivery',
    pending: 'Pending',
    completed: 'Completed',
  };
  return (
    <span className={cn('inline-flex px-3 py-1.5 rounded-full text-sm font-medium', styles[status] || styles.pending)}>
      {labels[status] || status}
    </span>
  );
}

function OrderDetailContent() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const { selectedShopId } = useShop();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const orderId = typeof params?.id === 'string' ? parseInt(params.id, 10) : null;

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const data = await ordersApi.getById(orderId);
      setOrder(data);
    } catch (error: any) {
      console.error('Failed to load order:', error);
      showToast(error.detail || 'Failed to load order', 'error');
      router.push('/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrder = async () => {
    try {
      setSyncing(true);
      showToast('Syncing order from Etsy...', 'info');
      await ordersApi.sync({ shopId: selectedShopId });
      showToast('Order synced successfully!', 'success');
      await loadOrder();
    } catch (error: any) {
      console.error('Failed to sync order:', error);
      showToast(error.detail || 'Failed to sync order', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[var(--text-muted)] text-lg">Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/orders')}
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>

        <button
          onClick={handleSyncOrder}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCcw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          <span>{syncing ? 'Syncing...' : 'Sync Order'}</span>
        </button>
      </div>

      {/* Order Header */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              Order {order.order_id}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                ID: {order.id}
              </span>
              {order.etsy_receipt_id && (
                <span className="flex items-center gap-1">
                  Etsy Receipt: {order.etsy_receipt_id}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(order.created_at)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--text-muted)] mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {order.currency} {order.total_price.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Order Status</p>
            <OrderStatus status={order.status} />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Payment Status</p>
            <PaymentStatus status={order.payment_status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer & Shipping */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer Information */}
          <DashboardCard title="Customer Information">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-bg)] text-[var(--primary)] flex items-center justify-center text-sm font-medium">
                  {order.buyer_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-primary)]">{order.buyer_name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{order.buyer_email}</p>
                </div>
              </div>
            </div>
          </DashboardCard>

          {/* Shipping Address */}
          <DashboardCard title="Shipping Address">
            {order.shipping_address ? (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[var(--text-muted)] mt-1 flex-shrink-0" />
                <div className="text-sm text-[var(--text-primary)] space-y-1">
                  {typeof order.shipping_address === 'object' ? (
                    <>
                      {order.shipping_address.name && <p className="font-medium">{order.shipping_address.name}</p>}
                      {order.shipping_address.address1 && <p>{order.shipping_address.address1}</p>}
                      {order.shipping_address.address2 && <p>{order.shipping_address.address2}</p>}
                      {order.shipping_address.city && order.shipping_address.state && (
                        <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}</p>
                      )}
                      {order.shipping_address.country && <p>{order.shipping_address.country}</p>}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{JSON.stringify(order.shipping_address, null, 2)}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] italic text-sm">No shipping address available</p>
            )}
          </DashboardCard>

          {/* Timestamps */}
          <DashboardCard title="Timestamps">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Created At</p>
                <p className="text-[var(--text-primary)]">{formatDate(order.created_at)}</p>
              </div>
              {order.updated_at && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Updated At</p>
                  <p className="text-[var(--text-primary)]">{formatDate(order.updated_at)}</p>
                </div>
              )}
              {order.synced_at && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Last Synced</p>
                  <p className="text-[var(--text-primary)]">{formatDate(order.synced_at)}</p>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Right Column - Order Items */}
        <div className="lg:col-span-2">
          <DashboardCard title="Order Items">
            {order.items && order.items.length > 0 ? (
              <div className="space-y-4">
                {order.items.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 border border-[var(--border-color)] rounded-lg"
                  >
                    {item.image && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-color)] flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.title || `Item ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23f0f0f0" width="80" height="80"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="12" dy="50%25" dx="50%25" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-[var(--text-primary)] mb-1">
                        {item.title || item.product_name || `Item ${index + 1}`}
                      </h3>
                      {item.sku && (
                        <p className="text-sm text-[var(--text-muted)] mb-2">SKU: {item.sku}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {item.quantity && (
                          <span className="text-[var(--text-muted)]">Qty: {item.quantity}</span>
                        )}
                        {item.price && (
                          <span className="font-medium text-[var(--text-primary)]">
                            {order.currency} {parseFloat(item.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.price && item.quantity && (
                      <div className="text-right">
                        <p className="text-sm text-[var(--text-muted)] mb-1">Subtotal</p>
                        <p className="font-medium text-[var(--text-primary)]">
                          {order.currency} {(parseFloat(item.price) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Order Summary */}
                <div className="border-t border-[var(--border-color)] pt-4 mt-4">
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span className="text-[var(--text-primary)]">Total</span>
                    <span className="text-[var(--text-primary)]">
                      {order.currency} {order.total_price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                <Package className="w-12 h-12 mb-2 opacity-50" />
                <p>No order items available</p>
                <p className="text-sm mt-1">Items data may not have been synced yet</p>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <DashboardLayout>
      <OrderDetailContent />
    </DashboardLayout>
  );
}
