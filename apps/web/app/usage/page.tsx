'use client';

/**
 * Usage & Costs Page
 * Track AI costs, API usage, and billing
 */

import { useState, useEffect } from 'react';
import { usageApi } from '@/lib/api';
import { DollarSign, TrendingUp, Zap, Calendar } from 'lucide-react';

interface UsageCost {
  id: number;
  resource_type: string;
  provider: string;
  operation: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  metadata: any;
  created_at: string;
}

export default function UsagePage() {
  const [summary, setSummary] = useState<any>(null);
  const [costs, setCosts] = useState<UsageCost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 50;

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, costsRes] = await Promise.all([
        usageApi.getSummary(),
        usageApi.getHistory(page, limit),
      ]);
      setSummary(summaryRes);
      setCosts(costsRes.costs);
      setTotal(costsRes.total);
    } catch (error: any) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  // Group costs by date for the chart
  const costsByDate = costs.reduce((acc: any, cost) => {
    const date = new Date(cost.created_at).toLocaleDateString();
    acc[date] = (acc[date] || 0) + cost.total_cost;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Usage & Costs</h1>
          <p className="text-slate-400 mt-1">
            Track your AI generation costs and API usage
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            Today
          </div>
          <div className="text-2xl font-bold text-white">
            ${summary?.today || '0.00'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Calendar className="w-4 h-4" />
            This Month
          </div>
          <div className="text-2xl font-bold text-teal-400">
            ${summary?.this_month || '0.00'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            Last Month
          </div>
          <div className="text-2xl font-bold text-slate-300">
            ${summary?.last_month || '0.00'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Zap className="w-4 h-4" />
            All Time
          </div>
          <div className="text-2xl font-bold text-white">
            ${summary?.all_time || '0.00'}
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Provider */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Cost by Provider</h2>
          <div className="space-y-3">
            {summary?.by_provider && Object.entries(summary.by_provider).length > 0 ? (
              Object.entries(summary.by_provider).map(([provider, cost]: [string, any]) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-400" />
                    <span className="text-white capitalize">{provider}</span>
                  </div>
                  <span className="text-slate-300 font-medium">${cost.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-4">No cost data available</p>
            )}
          </div>
        </div>

        {/* By Resource Type */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Cost by Resource</h2>
          <div className="space-y-3">
            {summary?.by_resource && Object.entries(summary.by_resource).length > 0 ? (
              Object.entries(summary.by_resource).map(([resource, cost]: [string, any]) => (
                <div key={resource} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-white capitalize">{resource.replace('_', ' ')}</span>
                  </div>
                  <span className="text-slate-300 font-medium">${cost.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-4">No cost data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Cost History Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Cost History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="p-4 text-left text-slate-300 font-medium">Date</th>
                <th className="p-4 text-left text-slate-300 font-medium">Resource</th>
                <th className="p-4 text-left text-slate-300 font-medium">Provider</th>
                <th className="p-4 text-left text-slate-300 font-medium">Operation</th>
                <th className="p-4 text-left text-slate-300 font-medium">Quantity</th>
                <th className="p-4 text-left text-slate-300 font-medium">Unit Cost</th>
                <th className="p-4 text-left text-slate-300 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading cost history...
                  </td>
                </tr>
              ) : costs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No cost history available. Costs will appear here after AI generation.
                  </td>
                </tr>
              ) : (
                costs.map(cost => (
                  <tr key={cost.id} className="hover:bg-slate-750 transition-colors">
                    <td className="p-4 text-slate-300 text-sm">
                      {new Date(cost.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-white capitalize">
                      {cost.resource_type.replace('_', ' ')}
                    </td>
                    <td className="p-4 text-white capitalize">{cost.provider}</td>
                    <td className="p-4 text-slate-300">{cost.operation}</td>
                    <td className="p-4 text-slate-300">{cost.quantity}</td>
                    <td className="p-4 text-slate-300 font-mono text-sm">
                      ${cost.unit_cost.toFixed(6)}
                    </td>
                    <td className="p-4 text-white font-semibold">
                      ${cost.total_cost.toFixed(4)}
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
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

      {/* Daily Breakdown Chart (simplified) */}
      {Object.keys(costsByDate).length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Daily Costs</h2>
          <div className="space-y-2">
            {Object.entries(costsByDate).map(([date, cost]: [string, any]) => (
              <div key={date} className="flex items-center gap-4">
                <div className="text-slate-400 text-sm w-32">{date}</div>
                <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-blue-500 h-full flex items-center px-3"
                    style={{
                      width: `${Math.min((cost / Math.max(...Object.values(costsByDate) as number[])) * 100, 100)}%`,
                    }}
                  >
                    <span className="text-white text-xs font-medium">${cost.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
