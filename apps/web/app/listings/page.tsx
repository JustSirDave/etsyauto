'use client';

/**
 * Listings Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { listingsApi } from '@/lib/api';
import { useShop } from '@/lib/shop-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Clock, CheckCircle, XCircle, RefreshCw, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ListingJob {
  id: number;
  product_id: number;
  shop_id: number;
  etsy_listing_id: string | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-[var(--background)] text-[var(--text-muted)]',
  scheduled: 'bg-[var(--info-bg)] text-[var(--info)]',
  processing: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  completed: 'bg-[var(--success-bg)] text-[var(--success)]',
  failed: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  cancelled: 'bg-[var(--background)] text-[var(--text-muted)]',
};

const statusIcons = {
  pending: Clock,
  scheduled: Clock,
  processing: Loader,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

function ListingsContent() {
  const [jobs, setJobs] = useState<ListingJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [retrying, setRetrying] = useState<Set<number>>(new Set());
  const { selectedShopId } = useShop();
  const limit = 20;

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [page, filterStatus, selectedShopId]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await listingsApi.getAll(page, limit, filterStatus, { shopId: selectedShopId });
      setJobs(response.jobs);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      setRetrying(prev => new Set(prev).add(jobId));
      await listingsApi.retry(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(`Retry failed: ${error.detail || error.message}`);
    } finally {
      setRetrying(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  };

  const handleCancel = async (jobId: number) => {
    if (!confirm('Cancel this job?')) return;
    try {
      await listingsApi.cancel(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(`Cancel failed: ${error.detail || error.message}`);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const stats = {
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Listing Jobs</h1>
          <p className="text-[var(--text-muted)] mt-1">Monitor your Etsy listing publication queue</p>
        </div>
        <button onClick={loadJobs} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Pending</p>
          <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{stats.pending}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Processing</p>
          <p className="text-3xl font-bold text-[var(--warning)] mt-1">{stats.processing}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Completed</p>
          <p className="text-3xl font-bold text-[var(--success)] mt-1">{stats.completed}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Failed</p>
          <p className="text-3xl font-bold text-[var(--danger)] mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[undefined, 'pending', 'processing', 'completed', 'failed'].map((status, i) => (
          <button key={i} onClick={() => setFilterStatus(status)} className={cn('px-4 py-2 rounded-lg transition-colors capitalize', filterStatus === status ? 'gradient-primary text-white shadow-lg shadow-[var(--primary)]/25' : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]')}>
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <DashboardCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Job ID</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Product</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Etsy ID</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Retries</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Created</th>
                <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">Loading...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">No listing jobs found.</td></tr>
              ) : (
                jobs.map(job => {
                  const StatusIcon = statusIcons[job.status as keyof typeof statusIcons] || Clock;
                  return (
                    <tr key={job.id} className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors">
                      <td className="py-4 px-5 text-[var(--text-primary)] font-mono">#{job.id}</td>
                      <td className="py-4 px-5">
                        <p className="text-[var(--text-primary)]">Product #{job.product_id}</p>
                        <p className="text-xs text-[var(--text-muted)]">Shop #{job.shop_id}</p>
                      </td>
                      <td className="py-4 px-5">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium', statusStyles[job.status] || statusStyles.pending)}>
                          <StatusIcon className={cn('w-3.5 h-3.5', job.status === 'processing' && 'animate-spin')} />
                          {job.status}
                        </span>
                        {job.error_message && <p className="text-xs text-[var(--danger)] mt-1 max-w-xs truncate">{job.error_message}</p>}
                      </td>
                      <td className="py-4 px-5 text-[var(--text-muted)] font-mono text-sm">{job.etsy_listing_id || '-'}</td>
                      <td className="py-4 px-5 text-[var(--text-muted)]">{job.retry_count > 0 ? <span className="text-[var(--warning)]">{job.retry_count}/3</span> : '0/3'}</td>
                      <td className="py-4 px-5 text-[var(--text-muted)] text-sm">{new Date(job.created_at).toLocaleString()}</td>
                      <td className="py-4 px-5">
                        <div className="flex gap-2 justify-end">
                          {job.status === 'failed' && job.retry_count < 3 && (
                            <button onClick={() => handleRetry(job.id)} disabled={retrying.has(job.id)} className="p-2 text-[var(--primary)] hover:bg-[var(--primary-bg)] rounded-lg disabled:opacity-50 transition-colors">
                              {retrying.has(job.id) ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </button>
                          )}
                          {['pending', 'scheduled'].includes(job.status) && (
                            <button onClick={() => handleCancel(job.id)} className="p-2 text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
    </div>
  );
}

export default function ListingsPage() {
  return <DashboardLayout><ListingsContent /></DashboardLayout>;
}
