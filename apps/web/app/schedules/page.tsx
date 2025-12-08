'use client';

/**
 * Schedules Page - Full Backend Integration
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Timer,
} from 'lucide-react';
import { schedulesApi, Schedule, ScheduleStats } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { ConfirmActionModal } from '@/components/schedules/ConfirmActionModal';
import { NewScheduleModal } from '@/components/schedules/NewScheduleModal';

// Helper function to format relative time
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    // Past
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absMins < 60) return `${absMins}m ago`;
    if (absHours < 24) return `${absHours}h ago`;
    return `${absDays}d ago`;
  } else {
    // Future
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  }
}

// Helper function to format cron to readable frequency
function formatCronFrequency(cronExpr: string): string {
  // Simple heuristics - can be enhanced
  if (cronExpr.includes('0 */6')) return 'Every 6 hours';
  if (cronExpr.includes('0 */12')) return 'Every 12 hours';
  if (cronExpr.includes('0 9 *')) return 'Daily at 9:00 AM';
  if (cronExpr.includes('0 2 * * 0')) return 'Weekly on Sunday';
  if (cronExpr.includes('0 0 1')) return 'Monthly';
  return cronExpr;
}

// Schedule Item Component
function ScheduleItem({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: Schedule;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const typeColors = {
    sync: 'bg-[var(--primary-bg)] text-[var(--primary)]',
    generate: 'bg-[var(--info-bg)] text-[var(--info)]',
    backup: 'bg-[var(--success-bg)] text-[var(--success)]',
    report: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  };

  const statusColors = {
    active: 'text-[var(--success)]',
    paused: 'text-[var(--warning)]',
    error: 'text-[var(--danger)]',
  };

  const statusIcons = {
    active: CheckCircle,
    paused: Pause,
    error: AlertCircle,
  };

  const StatusIcon = statusIcons[schedule.status];

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--primary)]/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${typeColors[schedule.type]} flex items-center justify-center`}>
          {schedule.type === 'sync' && <RefreshCw className="w-6 h-6" />}
          {schedule.type === 'generate' && <Zap className="w-6 h-6" />}
          {schedule.type === 'backup' && <Clock className="w-6 h-6" />}
          {schedule.type === 'report' && <Calendar className="w-6 h-6" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-[var(--text-primary)] font-semibold">{schedule.name}</h4>
            <span className={`flex items-center gap-1 text-sm ${statusColors[schedule.status]}`}>
              <StatusIcon className="w-4 h-4" />
              {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {formatCronFrequency(schedule.cron_expr)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[var(--text-secondary)] text-sm">Next Run</p>
          <p className="text-[var(--text-primary)] font-medium">
            {formatRelativeTime(schedule.next_run_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[var(--text-secondary)] text-sm">Last Run</p>
          <p className="text-[var(--text-muted)]">
            {formatRelativeTime(schedule.last_run_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(schedule.id)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] rounded-lg transition-colors"
            title={schedule.status === 'active' ? 'Pause schedule' : 'Activate schedule'}
          >
            {schedule.status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={() => onDelete(schedule.id)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors"
            title="Delete schedule"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<ScheduleStats>({ total: 0, active: 0, paused: 0, executions_today: 0 });
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    confirmText?: string;
    confirmButtonClass?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Load schedules from API
  const loadSchedules = async (statusFilter?: string) => {
    try {
      setLoading(true);
      const data = await schedulesApi.getAll(statusFilter === 'all' ? undefined : statusFilter);
      setSchedules(data.schedules);
      setStats(data.stats);
    } catch (error: any) {
      console.error('Failed to load schedules:', error);
      showToast(error.detail || 'Failed to load schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when filter changes
  useEffect(() => {
    loadSchedules(filter);
  }, [filter]);

  // Handle toggle schedule
  const handleToggle = async (id: number) => {
    try {
      const result = await schedulesApi.toggle(id);
      showToast(result.message, 'success');
      await loadSchedules(filter);
    } catch (error: any) {
      console.error('Failed to toggle schedule:', error);
      showToast(error.detail || 'Failed to toggle schedule', 'error');
    }
  };

  // Handle delete schedule
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const result = await schedulesApi.delete(id);
      showToast(result.message, 'success');
      await loadSchedules(filter);
    } catch (error: any) {
      console.error('Failed to delete schedule:', error);
      showToast(error.detail || 'Failed to delete schedule', 'error');
    }
  };

  // Handle pause all
  const handlePauseAll = () => {
    const activeCount = schedules.filter(s => s.status === 'active').length;
    
    if (activeCount === 0) {
      showToast('No active schedules to pause', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Pause All Schedules',
      message: `This will pause ${activeCount} active schedule${activeCount > 1 ? 's' : ''}. You can resume them anytime from Quick Actions. Continue?`,
      confirmText: 'Pause All',
      confirmButtonClass: 'bg-[var(--warning)] hover:opacity-90',
      action: async () => {
        try {
          setIsProcessingAction(true);
          const result = await schedulesApi.pauseAll();
          showToast(result.message, 'success');
          await loadSchedules(filter);
        } catch (error: any) {
          console.error('Failed to pause all schedules:', error);
          showToast(error.detail || 'Failed to pause all schedules', 'error');
        } finally {
          setIsProcessingAction(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle resume all
  const handleResumeAll = () => {
    const pausedCount = schedules.filter(s => s.status === 'paused').length;
    
    if (pausedCount === 0) {
      showToast('No paused schedules to resume', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Resume All Schedules',
      message: `This will resume ${pausedCount} paused schedule${pausedCount > 1 ? 's' : ''}. They will start running according to their schedules. Continue?`,
      confirmText: 'Resume All',
      confirmButtonClass: 'bg-[var(--success)] hover:opacity-90',
      action: async () => {
        try {
          setIsProcessingAction(true);
          const result = await schedulesApi.resumeAll();
          showToast(result.message, 'success');
          await loadSchedules(filter);
        } catch (error: any) {
          console.error('Failed to resume all schedules:', error);
          showToast(error.detail || 'Failed to resume all schedules', 'error');
        } finally {
          setIsProcessingAction(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle run all syncs
  const handleRunAllSyncs = () => {
    const syncSchedules = schedules.filter(s => s.type === 'sync' && s.status === 'active');

    if (syncSchedules.length === 0) {
      showToast('No active sync schedules found', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Run All Syncs Now',
      message: `This will immediately trigger ${syncSchedules.length} active sync schedule${syncSchedules.length > 1 ? 's' : ''}. This may take a few moments to complete. Continue?`,
      confirmText: 'Run Now',
      confirmButtonClass: 'bg-[var(--primary)] hover:opacity-90',
      action: async () => {
        try {
          setIsProcessingAction(true);
          const result = await schedulesApi.runAllSyncs();
          showToast(result.message, 'success');
          await loadSchedules(filter);
        } catch (error: any) {
          console.error('Failed to run syncs:', error);
          showToast(error.detail || 'Failed to run sync schedules', 'error');
        } finally {
          setIsProcessingAction(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle view calendar
  const handleViewCalendar = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Calendar View',
      message: 'Calendar view is coming soon! This feature will allow you to visualize all your schedules in a calendar format.',
      confirmText: 'Got it',
      confirmButtonClass: 'bg-[var(--primary)] hover:opacity-90',
      action: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Calendar className="w-7 h-7 text-[var(--primary)]" />
              Schedules
            </h1>
            <p className="text-[var(--text-muted)] mt-1">
              Automate your shop tasks with scheduled jobs
            </p>
          </div>
          <button
            onClick={() => setShowNewScheduleModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-white font-semibold rounded-lg hover:opacity-90 transition shadow-lg shadow-[var(--primary)]/25"
          >
            <Plus className="w-5 h-5" />
            New Schedule
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                {loading ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Total Schedules</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--success-bg)] flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
              </div>
              <div>
                {loading ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.active}</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--warning-bg)] flex items-center justify-center">
                <Pause className="w-5 h-5 text-[var(--warning)]" />
              </div>
              <div>
                {loading ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.paused}</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Paused</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--info-bg)] flex items-center justify-center">
                <Timer className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                {loading ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.executions_today}</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Executions Today</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedules List */}
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard
              title="Your Schedules"
              subtitle="Manage your automated tasks"
              action={
                <div className="flex items-center gap-2">
                  {(['all', 'active', 'paused'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filter === f
                          ? 'bg-[var(--primary)] text-white'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              }
            >
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-[var(--background)] animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                  <p className="text-[var(--text-muted)] text-lg">No schedules yet</p>
                  <p className="text-[var(--text-muted)] text-sm mt-1">
                    Create your first automated schedule to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <ScheduleItem
                      key={schedule.id}
                      schedule={schedule}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <DashboardCard title="Quick Actions">
              <div className="space-y-2">
                <button
                  onClick={handleRunAllSyncs}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Run All Syncs Now</span>
                </button>
                <button
                  onClick={handlePauseAll}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                >
                  <Pause className="w-5 h-5" />
                  <span>Pause All Schedules</span>
                </button>
                <button
                  onClick={handleResumeAll}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                >
                  <Play className="w-5 h-5" />
                  <span>Resume All Schedules</span>
                </button>
                <button
                  onClick={handleViewCalendar}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                >
                  <Calendar className="w-5 h-5" />
                  <span>View Calendar</span>
                </button>
              </div>
            </DashboardCard>

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-[var(--primary-bg)] to-[var(--info-bg)] border border-[var(--primary)]/30 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-[var(--text-primary)] font-semibold mb-2">Schedule Tips</h4>
                  <ul className="text-[var(--text-muted)] text-sm space-y-1">
                    <li>• Use schedules to automate repetitive tasks</li>
                    <li>• Monitor execution counts and errors</li>
                    <li>• Pause schedules during maintenance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => !isProcessingAction && setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmButtonClass={confirmModal.confirmButtonClass}
        isProcessing={isProcessingAction}
      />

      <NewScheduleModal
        isOpen={showNewScheduleModal}
        onClose={() => setShowNewScheduleModal(false)}
        onSuccess={() => loadSchedules(filter)}
        showToast={showToast}
      />
    </DashboardLayout>
  );
}
