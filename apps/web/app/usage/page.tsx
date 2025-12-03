'use client';

/**
 * Usage & Costs Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { usageApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { DollarSign, TrendingUp, Zap, Calendar, BarChart3 } from 'lucide-react';

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

function UsageContent() {
  const [summary, setSummary] = useState<any>(null);
  const [costs, setCosts] = useState<UsageCost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  useEffect(() => { loadData(); }, [page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, costsRes] = await Promise.all([usageApi.getSummary(), usageApi.getHistory(page, limit)]);
      setSummary(summaryRes);
      setCosts(costsRes.costs);
      setTotal(costsRes.total);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const costsByDate = costs.reduce((acc: any, cost) => {
    const date = new Date(cost.created_at).toLocaleDateString();
    acc[date] = (acc[date] || 0) + cost.total_cost;
    return acc;
  }, {});

  const statsCards = [
    { title: 'Today', value: summary?.today || '0.00', icon: DollarSign, color: 'primary' },
    { title: 'This Month', value: summary?.this_month || '0.00', icon: Calendar, color: 'accent' },
    { title: 'Last Month', value: summary?.last_month || '0.00', icon: TrendingUp, color: 'secondary' },
    { title: 'All Time', value: summary?.all_time || '0.00', icon: Zap, color: 'info' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Usage & Costs</h1>
          <p className="text-[var(--text-muted)]">Track your AI generation costs and API usage</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, i) => {
          const Icon = stat.icon;
          const colorClasses = {
            primary: 'text-[var(--primary)] bg-[var(--primary-bg)]',
            accent: 'text-[var(--accent)] bg-[var(--accent-bg)]',
            secondary: 'text-[var(--secondary)] bg-[var(--secondary-bg)]',
            info: 'text-[var(--info)] bg-[var(--info-bg)]',
          };
          const valueColors = {
            primary: 'text-[var(--text-primary)]',
            accent: 'text-[var(--accent)]',
            secondary: 'text-[var(--text-primary)]',
            info: 'text-[var(--text-primary)]',
          };
          return (
            <div key={i} className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[var(--text-muted)] text-sm">{stat.title}</span>
              </div>
              <p className={`text-2xl font-bold ${valueColors[stat.color as keyof typeof valueColors]}`}>
                ${stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Provider */}
        <DashboardCard title="Cost by Provider">
          <div className="space-y-4">
            {summary?.by_provider && Object.entries(summary.by_provider).length > 0 ? (
              Object.entries(summary.by_provider).map(([provider, cost]: [string, any]) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[var(--primary)]" />
                    <span className="text-[var(--text-primary)] capitalize">{provider}</span>
                  </div>
                  <span className="text-[var(--text-secondary)] font-medium font-mono">${cost.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <p className="text-[var(--text-muted)] text-center py-6">No cost data available</p>
            )}
          </div>
        </DashboardCard>

        {/* By Resource Type */}
        <DashboardCard title="Cost by Resource">
          <div className="space-y-4">
            {summary?.by_resource && Object.entries(summary.by_resource).length > 0 ? (
              Object.entries(summary.by_resource).map(([resource, cost]: [string, any]) => (
                <div key={resource} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[var(--accent)]" />
                    <span className="text-[var(--text-primary)] capitalize">{resource.replace('_', ' ')}</span>
                  </div>
                  <span className="text-[var(--text-secondary)] font-medium font-mono">${cost.toFixed(4)}</span>
                </div>
              ))
            ) : (
              <p className="text-[var(--text-muted)] text-center py-6">No cost data available</p>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Cost History Table */}
      <DashboardCard title="Cost History" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Resource</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Provider</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Operation</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Quantity</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Unit Cost</th>
                <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">Loading...</td></tr>
              ) : costs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">No cost history available. Costs will appear here after AI generation.</td></tr>
              ) : (
                costs.map(cost => (
                  <tr key={cost.id} className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors">
                    <td className="py-4 px-5 text-[var(--text-muted)] text-sm">{new Date(cost.created_at).toLocaleString()}</td>
                    <td className="py-4 px-5 text-[var(--text-primary)] capitalize">{cost.resource_type.replace('_', ' ')}</td>
                    <td className="py-4 px-5 text-[var(--text-primary)] capitalize">{cost.provider}</td>
                    <td className="py-4 px-5 text-[var(--text-muted)]">{cost.operation}</td>
                    <td className="py-4 px-5 text-[var(--text-muted)]">{cost.quantity}</td>
                    <td className="py-4 px-5 text-[var(--text-muted)] font-mono text-sm">${cost.unit_cost.toFixed(6)}</td>
                    <td className="py-4 px-5 text-right text-[var(--text-primary)] font-semibold">${cost.total_cost.toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-[var(--border-color)] p-4 flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg disabled:opacity-50 transition-colors">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg disabled:opacity-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </DashboardCard>

      {/* Daily Chart */}
      {Object.keys(costsByDate).length > 0 && (
        <DashboardCard title="Daily Costs">
          <div className="space-y-3">
            {Object.entries(costsByDate).map(([date, cost]: [string, any]) => (
              <div key={date} className="flex items-center gap-4">
                <div className="text-[var(--text-muted)] text-sm w-28">{date}</div>
                <div className="flex-1 bg-[var(--background)] rounded-full h-7 overflow-hidden">
                  <div
                    className="gradient-primary h-full flex items-center px-3 rounded-full"
                    style={{ width: `${Math.min((cost / Math.max(...Object.values(costsByDate) as number[])) * 100, 100)}%` }}
                  >
                    <span className="text-white text-xs font-medium">${cost.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}

export default function UsagePage() {
  return <DashboardLayout><UsageContent /></DashboardLayout>;
}
