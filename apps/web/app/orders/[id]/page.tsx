'use client';

/**
 * Order Detail Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ArrowLeft, Package, Calendar, User, MapPin, CreditCard, RefreshCcw } from 'lucide-react';
import { ordersApi, OrderDetail, teamApi, TeamMember } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { useShop } from '@/lib/shop-context';
import { useAuth } from '@/lib/auth-context';
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  normalizeOrderStatus,
  normalizePaymentStatus,
} from '@/lib/order-status';

function PaymentStatus({ status }: { status: string }) {
  const normalized = normalizePaymentStatus(status);
  const isPaid = normalized === 'paid';
  return (
    <div className={isPaid ? 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50' : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-50'}>
      <span className={isPaid ? 'w-2 h-2 rounded-full bg-green-600' : 'w-2 h-2 rounded-full bg-yellow-500'} />
      <span className={isPaid ? 'text-sm font-medium text-green-600' : 'text-sm font-medium text-yellow-700'}>
        {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
      </span>
    </div>
  );
}

function OrderStatus({ status }: { status: string }) {
  const normalized = normalizeOrderStatus(status);
  
  let badgeClass = '';
  switch (normalized) {
    case 'completed':
      badgeClass = 'bg-green-50 text-green-700';
      break;
    case 'in_transit':
      badgeClass = 'bg-yellow-50 text-yellow-700';
      break;
    case 'cancelled':
      badgeClass = 'bg-red-50 text-red-700';
      break;
    case 'refunded':
      badgeClass = 'bg-gray-200 text-gray-800';
      break;
    default:
      badgeClass = 'bg-gray-100 text-gray-700';
  }
  
  return (
    <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium ${badgeClass}`}>
      {ORDER_STATUS_LABELS[normalized]}
    </span>
  );
}

function OrderDetailContent() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const { selectedShopId } = useShop();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fulfilling, setFulfilling] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [note, setNote] = useState('');
  const [suppliers, setSuppliers] = useState<TeamMember[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [assigningSupplier, setAssigningSupplier] = useState(false);

  const orderId = typeof params?.id === 'string' ? parseInt(params.id, 10) : null;

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  useEffect(() => {
    if (user?.role === 'owner' || user?.role === 'admin') {
      teamApi.getMembers()
        .then((members) => setSuppliers(members.filter((m) => m.role === 'supplier')))
        .catch(() => setSuppliers([]));
    }
  }, [user?.role]);

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

  const handleFulfillOrder = async () => {
    if (!order) return;
    if (!trackingCode.trim()) {
      showToast('Tracking code is required', 'error');
      return;
    }
    try {
      setFulfilling(true);
      await ordersApi.fulfill(order.id, {
        tracking_code: trackingCode.trim(),
        carrier_name: carrierName.trim() || undefined,
        ship_date: shipDate || undefined,
        note: note.trim() || undefined,
        send_bcc: false,
      });
      showToast('Tracking submitted to Etsy', 'success');
      setTrackingCode('');
      setCarrierName('');
      setShipDate('');
      setNote('');
      await loadOrder();
    } catch (error: any) {
      console.error('Failed to submit tracking:', error);
      showToast(error.detail || 'Failed to submit tracking', 'error');
    } finally {
      setFulfilling(false);
    }
  };

  const handleAssignSupplier = async () => {
    if (!order || !selectedSupplierId) return;
    try {
      setAssigningSupplier(true);
      await ordersApi.assignSupplier(order.id, selectedSupplierId);
      showToast('Supplier assigned to order', 'success');
    } catch (error: any) {
      console.error('Failed to assign supplier:', error);
      showToast(error.detail || 'Failed to assign supplier', 'error');
    } finally {
      setAssigningSupplier(false);
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

        {(user?.role === 'owner' || user?.role === 'admin') && (
          <button
            onClick={handleSyncOrder}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCcw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            <span>{syncing ? 'Syncing...' : 'Sync Order'}</span>
          </button>
        )}
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
              {order.total_price === null ? '--' : `${order.currency} ${order.total_price.toFixed(2)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Order Status</p>
            <OrderStatus status={order.lifecycle_status || order.status} />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Payment Status</p>
            <PaymentStatus status={order.payment_status} />
          </div>
        </div>
      </div>

      {(user?.role === 'supplier' || user?.role === 'owner' || user?.role === 'admin') && (
        <DashboardCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Fulfillment</h2>
            <span className="text-sm text-[var(--text-muted)]">Status: {order.fulfillment_status || 'unshipped'}</span>
          </div>
          {(user?.role === 'owner' || user?.role === 'admin') && suppliers.length > 0 && (
            <div className="mb-4 flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1">
                <label className="block text-sm text-[var(--text-muted)] mb-2">Assign Supplier</label>
                <select
                  value={selectedSupplierId ?? ''}
                  onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.user_id} value={supplier.user_id}>
                      {supplier.name} ({supplier.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssignSupplier}
                disabled={!selectedSupplierId || assigningSupplier}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {assigningSupplier ? 'Assigning...' : 'Assign Supplier'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Tracking Code</label>
              <input
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                placeholder="Enter tracking number"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Carrier</label>
              <input
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                placeholder="USPS, UPS, DHL, etc."
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Shipment Date</label>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Note</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                placeholder="Optional note to buyer"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleFulfillOrder}
              disabled={fulfilling}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {fulfilling ? 'Submitting...' : 'Submit Tracking'}
            </button>
          </div>
        </DashboardCard>
      )}

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
                      {order.total_price != null ? `${order.currency} ${order.total_price.toFixed(2)}` : '--'}
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
