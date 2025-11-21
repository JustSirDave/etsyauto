'use client';

/**
 * Listings Management Page
 * Track job queue, retry failed listings, view status
 */

import { useState, useEffect } from 'react';
import { listingsApi } from '@/lib/api';
import { Clock, CheckCircle, XCircle, RefreshCw, Play, Loader } from 'lucide-react';

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

const statusColors = {
  pending: 'bg-slate-700 text-slate-300',
  scheduled: 'bg-blue-900/30 text-blue-400',
  processing: 'bg-yellow-900/30 text-yellow-400',
  completed: 'bg-green-900/30 text-green-400',
  failed: 'bg-red-900/30 text-red-400',
  cancelled: 'bg-slate-700 text-slate-400',
};

const statusIcons = {
  pending: Clock,
  scheduled: Clock,
  processing: Loader,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

export default function ListingsPage() {
  const [jobs, setJobs] = useState<ListingJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [retrying, setRetrying] = useState<Set<number>>(new Set());

  const limit = 20;

  useEffect(() => {
    loadJobs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [page, filterStatus]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await listingsApi.getAll(page, limit, filterStatus);
      setJobs(response.jobs);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Failed to load listing jobs:', error);
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
      console.error('Retry failed:', error);
      alert(`Retry failed: ${error.detail || error.message}`);
    } finally {
      setRetrying(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleCancel = async (jobId: number) => {
    if (!confirm('Cancel this listing job?')) return;

    try {
      await listingsApi.cancel(jobId);
      await loadJobs();
    } catch (error: any) {
      console.error('Cancel failed:', error);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Listing Jobs</h1>
          <p className="text-slate-400 mt-1">
            Monitor and manage your Etsy listing publication queue
          </p>
        </div>
        <button
          onClick={loadJobs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Pending</div>
          <div className="text-2xl font-bold text-slate-300 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Processing</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.processing}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Completed</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Failed</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{stats.failed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterStatus(undefined)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            !filterStatus
              ? 'bg-teal-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          All
        </button>
        {['pending', 'processing', 'completed', 'failed'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
              filterStatus === status
                ? 'bg-teal-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="p-4 text-left text-slate-300 font-medium">Job ID</th>
                <th className="p-4 text-left text-slate-300 font-medium">Product</th>
                <th className="p-4 text-left text-slate-300 font-medium">Status</th>
                <th className="p-4 text-left text-slate-300 font-medium">Etsy ID</th>
                <th className="p-4 text-left text-slate-300 font-medium">Retries</th>
                <th className="p-4 text-left text-slate-300 font-medium">Created</th>
                <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No listing jobs found. Create your first listing to get started.
                  </td>
                </tr>
              ) : (
                jobs.map(job => {
                  const StatusIcon = statusIcons[job.status as keyof typeof statusIcons] || Clock;

                  return (
                    <tr key={job.id} className="hover:bg-slate-750 transition-colors">
                      <td className="p-4 text-white font-mono">#{job.id}</td>
                      <td className="p-4 text-white">
                        <div>Product #{job.product_id}</div>
                        <div className="text-xs text-slate-400 mt-1">Shop #{job.shop_id}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              statusColors[job.status as keyof typeof statusColors] || statusColors.pending
                            }`}
                          >
                            <StatusIcon className={`w-3.5 h-3.5 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                            {job.status}
                          </span>
                        </div>
                        {job.error_message && (
                          <div className="text-xs text-red-400 mt-1 max-w-xs truncate" title={job.error_message}>
                            {job.error_message}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-slate-300 font-mono text-sm">
                        {job.etsy_listing_id || '-'}
                      </td>
                      <td className="p-4 text-slate-300">
                        {job.retry_count > 0 ? (
                          <span className="text-yellow-400">{job.retry_count}/3</span>
                        ) : (
                          '0/3'
                        )}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {job.status === 'failed' && job.retry_count < 3 && (
                            <button
                              onClick={() => handleRetry(job.id)}
                              disabled={retrying.has(job.id)}
                              className="text-teal-400 hover:text-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Retry"
                            >
                              {retrying.has(job.id) ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {(job.status === 'pending' || job.status === 'scheduled') && (
                            <button
                              onClick={() => handleCancel(job.id)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Cancel"
                            >
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-700 p-4 flex items-center justify-between">
            <div className="text-slate-400 text-sm">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} jobs
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
