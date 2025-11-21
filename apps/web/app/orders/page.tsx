'use client';

/**
 * Orders Management Page
 * View Etsy orders and sync status
 */

import { useState, useEffect } from 'react';
import { ordersApi } from '@/lib/api';
import { RefreshCw, Package, Truck, CheckCircle, Clock, ExternalLink } from 'lucide-react';

interface Order {
  id: number;
  etsy_order_id: string;
  shop_id: number;
  status: string;
  buyer_email: string;
  total_price: number;
  currency: string;
  items_count: number;
  printful_order_id: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  synced_at: string;
  created_at: string;
}

const statusColors = {
  pending: 'bg-yellow-900/30 text-yellow-400',
  processing: 'bg-blue-900/30 text-blue-400',
  shipped: 'bg-teal-900/30 text-teal-400',
  delivered: 'bg-green-900/30 text-green-400',
  cancelled: 'bg-red-900/30 text-red-400',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const limit = 20;

  useEffect(() => {
    loadOrders();
  }, [page]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await ordersApi.getAll(page, limit);
      setOrders(response.orders);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await ordersApi.sync();
      await loadOrders();
    } catch (error: any) {
      console.error('Sync failed:', error);
      alert(`Sync failed: ${error.detail || error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Orders</h1>
          <p className="text-slate-400 mt-1">
            View and manage your Etsy orders and fulfillment
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Orders'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Clock className="w-4 h-4" />
            Pending
          </div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Package className="w-4 h-4" />
            Processing
          </div>
          <div className="text-2xl font-bold text-blue-400">{stats.processing}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Truck className="w-4 h-4" />
            Shipped
          </div>
          <div className="text-2xl font-bold text-teal-400">{stats.shipped}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <CheckCircle className="w-4 h-4" />
            Delivered
          </div>
          <div className="text-2xl font-bold text-green-400">{stats.delivered}</div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="p-4 text-left text-slate-300 font-medium">Order ID</th>
                <th className="p-4 text-left text-slate-300 font-medium">Buyer</th>
                <th className="p-4 text-left text-slate-300 font-medium">Status</th>
                <th className="p-4 text-left text-slate-300 font-medium">Items</th>
                <th className="p-4 text-left text-slate-300 font-medium">Total</th>
                <th className="p-4 text-left text-slate-300 font-medium">Tracking</th>
                <th className="p-4 text-left text-slate-300 font-medium">Date</th>
                <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No orders found. Orders will appear here once synced from Etsy.
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-750 transition-colors">
                    <td className="p-4">
                      <div className="text-white font-mono text-sm">
                        {order.etsy_order_id.slice(0, 16)}...
                      </div>
                      {order.printful_order_id && (
                        <div className="text-xs text-slate-400 mt-1">
                          Printful: {order.printful_order_id}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-white">{order.buyer_email}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusColors[order.status as keyof typeof statusColors] || statusColors.pending
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-white">{order.items_count}</td>
                    <td className="p-4 text-white">
                      {order.currency} {order.total_price.toFixed(2)}
                    </td>
                    <td className="p-4">
                      {order.tracking_number ? (
                        <div>
                          <div className="text-white text-sm">{order.tracking_carrier}</div>
                          <div className="text-slate-400 text-xs font-mono mt-1">
                            {order.tracking_number}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400 text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <a
                        href={`https://www.etsy.com/your/orders/${order.etsy_order_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:text-teal-300 transition-colors"
                        title="View on Etsy"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-700 p-4 flex items-center justify-between">
            <div className="text-slate-400 text-sm">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} orders
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
