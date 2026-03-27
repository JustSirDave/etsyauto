'use client';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Bell, Loader2, Trash2, Check, CheckCheck, CheckCircle, XCircle, AlertTriangle, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';
import type { Notification } from '@/lib/api';

function formatNotifTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotifIcon(type: Notification['type']) {
  const cls = 'w-5 h-5';
  switch ((type as string).toLowerCase()) {
    case 'success':
      return <CheckCircle className={`${cls} text-[var(--success)]`} />;
    case 'error':
      return <XCircle className={`${cls} text-[var(--danger)]`} />;
    case 'warning':
      return <AlertTriangle className={`${cls} text-[var(--warning)]`} />;
    case 'order':
      return <ShoppingCart className={`${cls} text-[var(--info)]`} />;
    default:
      return <Bell className={`${cls} text-[var(--info)]`} />;
  }
}

export interface NotificationsTabProps {
  notifications: Notification[];
  loading: boolean;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onMarkRead: (id: number) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
  onDelete: (id: number) => void | Promise<void>;
  onDeleteAll: () => void | Promise<void>;
}

export function NotificationsTab({
  notifications: notifList,
  loading: loadingNotifs,
  unreadOnly: notifUnreadOnly,
  onUnreadOnlyChange: setNotifUnreadOnly,
  onMarkRead: handleNotifMarkRead,
  onMarkAllRead: handleNotifMarkAllRead,
  onDelete: handleNotifDelete,
  onDeleteAll: handleNotifDeleteAll,
}: NotificationsTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <DashboardCard>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('notifications.title')}</h2>
              <p className="text-sm text-[var(--text-muted)]">{notifList.filter((n) => !n.read).length} unread</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNotifUnreadOnly(!notifUnreadOnly)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                notifUnreadOnly
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--background)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
              )}
            >
              {notifUnreadOnly ? t('notifications.unread') : t('notifications.all')}
            </button>
            {notifList.some((n) => !n.read) && (
              <button
                onClick={handleNotifMarkAllRead}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                {t('notifications.markAllRead')}
              </button>
            )}
            {notifList.length > 0 && (
              <button
                onClick={handleNotifDeleteAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-lg text-sm text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>
        </div>

        {loadingNotifs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          </div>
        ) : notifList.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] font-medium">
              {notifUnreadOnly ? t('notifications.noneUnread') : t('notifications.none')}
            </p>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {notifUnreadOnly ? t('notifications.allCaughtUp') : t('notifications.willAppear')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifList.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-xl border transition-colors',
                  n.read
                    ? 'bg-[var(--card-bg)] border-[var(--border-color)]'
                    : 'bg-[var(--primary-bg)] border-[var(--primary)]/20'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">{getNotifIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={cn(
                        'font-semibold text-sm',
                        n.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                      )}
                    >
                      {n.title}
                    </h4>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{n.message}</p>
                  {n.action_label && n.action_url && (
                    <a
                      href={n.action_url}
                      className="inline-block mt-2 text-sm text-[var(--primary)] font-medium hover:underline"
                    >
                      {n.action_label} &rarr;
                    </a>
                  )}
                  <p className="text-xs text-[var(--text-muted)] mt-2">{formatNotifTime(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.read && (
                    <button
                      onClick={() => handleNotifMarkRead(n.id)}
                      className="p-1.5 hover:bg-[var(--background)] rounded-lg transition-colors"
                      title={t('notifications.markAsRead')}
                    >
                      <Check className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                  )}
                  <button
                    onClick={() => handleNotifDelete(n.id)}
                    className="p-1.5 hover:bg-[var(--danger-bg)] rounded-lg transition-colors group"
                    title={t('notifications.delete')}
                  >
                    <Trash2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--danger)]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
