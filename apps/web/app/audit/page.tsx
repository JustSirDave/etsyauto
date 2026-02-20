'use client';

/**
 * Audit Logs Page
 * View and filter audit logs with tenant-scoping
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Shield,
  Filter,
  Download,
  Search,
  Calendar,
  User,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import { AuditLogDetailModal } from '@/components/audit/AuditLogDetailModal';
import { useShop } from '@/lib/shop-context';
import { useLanguage } from '@/lib/language-context';

// Types
interface AuditLog {
  id: number;
  request_id: string;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_ip: string | null;
  tenant_id: number | null;
  shop_id: number | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  http_method: string | null;
  http_path: string | null;
  http_status: number | null;
  status: string;
  error_message: string | null;
  request_metadata: any;
  response_metadata: any;
  attempt: number;
  latency_ms: number | null;
  created_at: string;
}

interface AuditStats {
  total_actions: number;
  success_count: number;
  failure_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  top_actions: Array<{ action: string; count: number }>;
  top_actors: Array<{ email: string; count: number }>;
}

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const { selectedShopId } = useShop();
  const { t } = useLanguage();
  
  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    action: '',
    status: '',
    actor_email: '',
    shop_id: '',
    date_from: '',
    date_to: '',
  });
  
  const [showFilters, setShowFilters] = useState(false);

  // Load audit logs
  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      
      if (filters.action) params.append('action', filters.action);
      if (filters.status) params.append('status', filters.status);
      if (filters.actor_email) params.append('actor_email', filters.actor_email);
      if (filters.shop_id) params.append('shop_id', filters.shop_id);
      if (selectedShopId) params.set('shop_id', String(selectedShopId));
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audit/logs/?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) throw new Error(t('audit.loadFailed'));
      
      const data = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      showToast(error.message || t('audit.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load statistics
  const loadStats = async () => {
    try {
      const statsParams = new URLSearchParams();
      if (selectedShopId) {
        statsParams.append('shop_id', String(selectedShopId));
      }
      const statsQuery = statsParams.toString() ? `?${statsParams.toString()}` : '';
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audit/logs/stats${statsQuery}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) throw new Error(t('audit.loadFailed'));
      
      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    }
  };
  
  useEffect(() => {
    loadAuditLogs();
  }, [page, filters, selectedShopId]);
  
  useEffect(() => {
    loadStats();
  }, [selectedShopId]);
  
  // Apply filters
  const handleApplyFilters = () => {
    setPage(1); // Reset to first page
    loadAuditLogs();
  };
  
  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      action: '',
      status: '',
      actor_email: '',
      shop_id: '',
      date_from: '',
      date_to: '',
    });
    setPage(1);
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      failure: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      pending: 'bg-blue-100 text-blue-800',
    };
    
    const icons = {
      success: CheckCircle,
      failure: AlertCircle,
      error: XCircle,
      pending: Clock,
    };
    
    const Icon = icons[status as keyof typeof icons] || Activity;
    const style = styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </span>
    );
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Format action name
  const formatAction = (action: string) => {
    return action.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' > ');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-7 h-7 text-blue-600" />
              {t('audit.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('audit.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
              showFilters 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
            }`}
          >
            <Filter className="w-5 h-5" />
            {t('audit.filters')}
          </button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_actions.toLocaleString()}</p>
                  <p className="text-gray-600 text-sm">{t('audit.totalActions')}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.success_count.toLocaleString()}</p>
                  <p className="text-gray-600 text-sm">{t('audit.successful')}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.failure_count + stats.error_count}</p>
                  <p className="text-gray-600 text-sm">{t('audit.failedErrors')}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.avg_latency_ms ? `${stats.avg_latency_ms.toFixed(0)}ms` : 'N/A'}
                  </p>
                  <p className="text-gray-600 text-sm">{t('audit.avgLatency')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <DashboardCard title={t('audit.filters')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('audit.actionType')}
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('audit.allActions')}</option>
                  <option value="auth.login">Auth - Login</option>
                  <option value="auth.logout">Auth - Logout</option>
                  <option value="product.create">Product - Create</option>
                  <option value="product.update">Product - Update</option>
                  <option value="ai.generate">AI - Generate</option>
                  <option value="listing.publish">Listing - Publish</option>
                  <option value="listing.sync">Listing - Sync</option>
                  <option value="ingestion.start">Ingestion - Start</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('audit.status')}
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('audit.allStatuses')}</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="error">Error</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('audit.actorEmail')}
                </label>
                <input
                  type="text"
                  value={filters.actor_email}
                  onChange={(e) => setFilters({ ...filters, actor_email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('audit.dateFrom')}
                </label>
                <input
                  type="datetime-local"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('audit.dateTo')}
                </label>
                <input
                  type="datetime-local"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('audit.apply')}
                </button>
                <button
                  onClick={handleResetFilters}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('audit.reset')}
                </button>
              </div>
            </div>
          </DashboardCard>
        )}

        {/* Audit Logs Table */}
        <DashboardCard title={`${t('audit.title')} (${total.toLocaleString()} ${t('audit.total')})`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">{t('audit.noLogs')}</p>
              <p className="text-gray-500 text-sm mt-1">{t('audit.adjustFilters')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.timestamp')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.action')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.actor')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.status')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.target')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.latency')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('audit.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {formatAction(log.action)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.actor_email || t('audit.system')}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.target_type ? `${log.target_type}#${log.target_id}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          {t('audit.view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                {t('audit.showing')} {(page - 1) * pageSize + 1} {t('audit.to')} {Math.min(page * pageSize, total)} {t('audit.of')} {total.toLocaleString()} {t('audit.results')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-700">
                  {t('audit.page')} {page} {t('audit.of')} {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </DashboardCard>
      </div>
      
      {/* Detail Modal */}
      {selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </DashboardLayout>
  );
}
