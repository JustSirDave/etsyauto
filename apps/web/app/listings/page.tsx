'use client';

/**
 * Listings Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { listingsApi } from '@/lib/api';
import { useShop } from '@/lib/shop-context';
import { useLanguage } from '@/lib/language-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Clock, CheckCircle, XCircle, RefreshCw, Loader, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ListingJob {
  id: number;
  product_id: number;
  shop_id: number;
  etsy_listing_id: string | null;
  status: string;
  error_code?: string | null;
  error_message: string | null;
  policy_flags?: string[] | null;
  policy_block_reason?: string | null;
  retry_count: number;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  // Policy errors
  description_empty: 'Description is missing',
  required_missing_fields: 'Required fields are missing (check category, description, price)',
  prohibited_terms: 'Title or description contains prohibited terms',
  handmade_violation: "Product does not meet Etsy handmade policy",

  // Etsy API errors
  rate_limited: 'Etsy rate limit hit — will retry automatically',
  etsy_api_error: 'Etsy API returned an error',
  etsy_auth_error: 'Shop connection expired — reconnect your Etsy shop',
  listing_already_exists: 'This product is already listed on Etsy',
  invalid_taxonomy: 'Invalid category — update the product category',
  invalid_shipping: 'Shipping profile missing or invalid',

  // Worker/system errors
  token_expired: 'Shop OAuth token expired — reconnect your shop',
  worker_timeout: 'Publishing timed out — will retry',
  max_retries_exceeded: 'Publishing failed after multiple attempts',
  unknown: 'An unexpected error occurred',
};

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
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [expandedJobDetail, setExpandedJobDetail] = useState<any | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const { selectedShopId } = useShop();
  const { t } = useLanguage();
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

  const toggleExpandJob = async (jobId: number) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      setExpandedJobDetail(null);
      return;
    }
    setExpandedJobId(jobId);
    setExpandedJobDetail(null);
    setExpandedLoading(true);
    try {
      const detail = await listingsApi.getById(jobId);
      setExpandedJobDetail(detail);
    } catch (error) {
      console.error('Failed to load job detail', error);
    } finally {
      setExpandedLoading(false);
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      setRetrying(prev => new Set(prev).add(jobId));
      await listingsApi.retry(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(`${t('listings.retryFailed')} ${error.detail || error.message}`);
    } finally {
      setRetrying(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  };

  const handleCancel = async (jobId: number) => {
    if (!confirm(t('listings.cancelJob'))) return;
    try {
      await listingsApi.cancel(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(`${t('listings.cancelFailed')} ${error.detail || error.message}`);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const stats = {
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  const getReadableReason = (job: ListingJob) => {
    if (job.status === 'policy_blocked') {
      if (job.policy_flags && job.policy_flags.length > 0) {
        const primary = job.policy_flags[0];
        return ERROR_MESSAGES[primary] || `Policy issue: ${primary}`;
      }
      if (job.policy_block_reason) {
        return job.policy_block_reason;
      }
    }
    if (job.error_code) {
      return ERROR_MESSAGES[job.error_code] || job.error_message || job.error_code;
    }
    return job.error_message || '';
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('listings.title')}</h1>
          <p className="text-[var(--text-muted)] mt-1">{t('listings.subtitle')}</p>
        </div>
        <button onClick={loadJobs} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors">
          <RefreshCw className="w-4 h-4" />{t('listings.refresh')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">{t('listings.pending')}</p>
          <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{stats.pending}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">{t('listings.processing')}</p>
          <p className="text-3xl font-bold text-[var(--warning)] mt-1">{stats.processing}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">{t('listings.completed')}</p>
          <p className="text-3xl font-bold text-[var(--success)] mt-1">{stats.completed}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">{t('listings.failed')}</p>
          <p className="text-3xl font-bold text-[var(--danger)] mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[undefined, 'pending', 'processing', 'completed', 'failed'].map((status, i) => (
          <button key={i} onClick={() => setFilterStatus(status)} className={cn('px-4 py-2 rounded-lg transition-colors capitalize', filterStatus === status ? 'gradient-primary text-white shadow-lg shadow-[var(--primary)]/25' : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]')}>
            {status ? t('listings.' + status) : t('listings.all')}
          </button>
        ))}
      </div>

      {/* Table */}
      <DashboardCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.jobId')}</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.product')}</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.status')}</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.etsyId')}</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.retries')}</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.created')}</th>
                <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('listings.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">{t('common.loading')}</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">{t('listings.noJobs')}</td></tr>
              ) : (
                jobs.map(job => {
                  const StatusIcon = statusIcons[job.status as keyof typeof statusIcons] || Clock;
                  const isErrorState = ['failed', 'cancelled', 'policy_blocked'].includes(job.status);
                  const reason = getReadableReason(job);
                  return (
                    <>
                      <tr
                        key={job.id}
                        className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors cursor-pointer"
                        onClick={() => toggleExpandJob(job.id)}
                      >
                        <td className="py-4 px-5 text-[var(--text-primary)] font-mono">#{job.id}</td>
                        <td className="py-4 px-5">
                          <p className="text-[var(--text-primary)]">Product #{job.product_id}</p>
                          <p className="text-xs text-[var(--text-muted)]">Shop #{job.shop_id}</p>
                        </td>
                        <td className="py-4 px-5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
                              statusStyles[job.status] || statusStyles.pending,
                              isErrorState && 'bg-[var(--danger-bg)] text-[var(--danger)]'
                            )}
                          >
                            <StatusIcon
                              className={cn(
                                'w-3.5 h-3.5',
                                job.status === 'processing' && 'animate-spin'
                              )}
                            />
                            {job.status}
                          </span>
                          {isErrorState && reason && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-[var(--danger)] max-w-xs">
                              <span className="truncate">{reason}</span>
                              {job.error_message && (
                                <span
                                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                  title={job.error_message}
                                >
                                  <HelpCircle className="w-3 h-3 inline-block" />
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 text-[var(--text-muted)] font-mono text-sm">
                          {job.etsy_listing_id || '-'}
                        </td>
                        <td className="py-4 px-5 text-[var(--text-muted)]">
                          {job.retry_count > 0 ? (
                            <span className="text-[var(--warning)]">{job.retry_count}/3</span>
                          ) : (
                            '0/3'
                          )}
                        </td>
                        <td className="py-4 px-5 text-[var(--text-muted)] text-sm">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-5">
                          <div
                            className="flex gap-2 justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isErrorState &&
                              ['rate_limited', 'worker_timeout'].includes(
                                (job.error_code || '') as string
                              ) &&
                              job.retry_count < 3 && (
                                <button
                                  onClick={() => handleRetry(job.id)}
                                  disabled={retrying.has(job.id)}
                                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--primary)] hover:bg-[var(--primary-bg)] disabled:opacity-50 transition-colors"
                                >
                                  {retrying.has(job.id) ? (
                                    <Loader className="w-3 h-3 animate-spin inline-block" />
                                  ) : (
                                    'Retry'
                                  )}
                                </button>
                              )}
                            {['pending', 'scheduled'].includes(job.status) && (
                              <button
                                onClick={() => handleCancel(job.id)}
                                className="p-2 text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                            {job.status === 'policy_blocked' && (
                              <a
                                href={`/products?edit=${job.product_id}`}
                                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--primary)] hover:bg-[var(--primary-bg)]"
                              >
                                Edit Product →
                              </a>
                            )}
                            {['etsy_auth_error', 'token_expired'].includes(
                              (job.error_code || '') as string
                            ) && (
                              <a
                                href="/settings/shops"
                                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--primary)] hover:bg-[var(--primary-bg)]"
                              >
                                Reconnect Shop →
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedJobId === job.id && (
                        <tr className="border-b border-[var(--border-color)] bg-[var(--background)]/60">
                          <td colSpan={7} className="px-5 pb-4">
                            {expandedLoading ? (
                              <div className="py-3 text-sm text-[var(--text-muted)]">
                                {t('common.loading')}
                              </div>
                            ) : expandedJobDetail ? (
                              <div className="space-y-2 text-xs text-[var(--text-primary)]">
                                <div className="flex gap-4 flex-wrap">
                                  <div>
                                    <span className="font-semibold">Status:</span>{' '}
                                    {expandedJobDetail.status}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Retries:</span>{' '}
                                    {expandedJobDetail.retry_count}
                                  </div>
                                  {expandedJobDetail.completed_at && (
                                    <div>
                                      <span className="font-semibold">Failed at:</span>{' '}
                                      {new Date(
                                        expandedJobDetail.completed_at
                                      ).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                {expandedJobDetail.error_message && (
                                  <div>
                                    <span className="font-semibold">Error:</span>{' '}
                                    {expandedJobDetail.error_message}
                                  </div>
                                )}
                                {expandedJobDetail.policy_flags &&
                                  expandedJobDetail.policy_flags.length > 0 && (
                                    <div>
                                      <span className="font-semibold">Policy flags:</span>{' '}
                                      {expandedJobDetail.policy_flags.join(', ')}
                                    </div>
                                  )}
                                {expandedJobDetail.policy_block_reason && (
                                  <div>
                                    <span className="font-semibold">Block reason:</span>{' '}
                                    {expandedJobDetail.policy_block_reason}
                                  </div>
                                )}
                                {expandedJobDetail.error_detail && (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-[var(--text-secondary)]">
                                      Raw error detail
                                    </summary>
                                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-[var(--card-bg)] p-2 text-[10px] text-[var(--text-secondary)]">
                                      {JSON.stringify(
                                        expandedJobDetail.error_detail,
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            ) : (
                              <div className="py-3 text-sm text-[var(--text-muted)]">
                                {t('listings.noDetails')}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-[var(--border-color)] p-4 flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">{t('listings.showing')} {(page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg disabled:opacity-50 transition-colors">{t('common.previous')}</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg disabled:opacity-50 transition-colors">{t('common.next')}</button>
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
