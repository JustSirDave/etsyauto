'use client';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  Eye,
  Crown,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';
import type { TeamMember, User } from '@/lib/api';

function getRoleColor(role: string) {
  return (
    {
      owner: 'text-[var(--warning)] bg-[var(--warning-bg)]',
      admin: 'text-[var(--primary)] bg-[var(--primary-bg)]',
      viewer: 'text-[var(--text-muted)] bg-[var(--background)]',
      member: 'text-[var(--success)] bg-[var(--success-bg)]',
    }[role] || 'text-[var(--text-muted)] bg-[var(--background)]'
  );
}

function getRoleIcon(role: string) {
  return (
    {
      owner: <Crown className="w-4 h-4" />,
      admin: <Shield className="w-4 h-4" />,
      viewer: <Eye className="w-4 h-4" />,
      member: <Users className="w-4 h-4" />,
    }[role] || <Users className="w-4 h-4" />
  );
}

export interface TeamTabProps {
  teamMembers: TeamMember[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  toast?: unknown;
  user: User | null | undefined;
  canManageTeam: boolean;
  onOpenInvite: () => void;
  onOpenShopAccess: (member: TeamMember) => void;
  onRemoveMember: (userId: number, name: string) => void;
}

export function TeamTab({
  teamMembers,
  loading: loadingTeam,
  user,
  canManageTeam,
  onOpenInvite,
  onOpenShopAccess,
  onRemoveMember,
}: TeamTabProps) {
  const { t } = useLanguage();

  const getShopAccessLabel = (member: TeamMember) => {
    if (member.role === 'owner' || member.role === 'admin') return t('settings.allShops');
    const count = member.allowed_shop_ids?.length || 0;
    if (count === 0) return t('settings.noShops');
    return count > 1
      ? t('settings.shopCountPlural').replace('{count}', String(count))
      : t('settings.shopCount').replace('{count}', String(count));
  };

  return (
    <div className="space-y-6">
      <DashboardCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.teamMembers')}</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">{t('settings.manageAccess')}</p>
          </div>
          {canManageTeam && (
            <button
              onClick={onOpenInvite}
              className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-white rounded-lg shadow-lg shadow-[var(--primary)]/25"
            >
              <UserPlus className="w-4 h-4" />
              {t('settings.invite')}
            </button>
          )}
        </div>
        {loadingTeam ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-semibold">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[var(--text-primary)] font-medium">{member.name}</p>
                      {member.user_id === user?.id && (
                        <span className="px-2 py-0.5 bg-[var(--primary-bg)] text-[var(--primary)] text-xs rounded">
                          {t('common.you')}
                        </span>
                      )}
                      {member.invitation_status === 'pending' && (
                        <span className="px-2 py-0.5 bg-[var(--warning-bg)] text-[var(--warning)] text-xs rounded flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {t('common.pending')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full',
                      getRoleColor(member.role)
                    )}
                  >
                    {getRoleIcon(member.role)}
                    <span className="text-sm font-medium capitalize">{member.role}</span>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs bg-[var(--background)] text-[var(--text-muted)] border border-[var(--border-color)]">
                    {getShopAccessLabel(member)}
                  </span>
                  {canManageTeam && member.user_id !== user?.id && (member.role === 'viewer' || member.role === 'member') && (
                    <button
                      onClick={() => onOpenShopAccess(member)}
                      className="px-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {t('settings.shopAccess')}
                    </button>
                  )}
                  {canManageTeam && member.user_id !== user?.id && (
                    <button
                      onClick={() => onRemoveMember(member.user_id, member.name)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.teamRoles')}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('settings.rolesDescription')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0',
                getRoleColor('owner')
              )}
            >
              {getRoleIcon('owner')}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[var(--text-primary)]">{t('settings.roles.owner')}</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{t('settings.roles.ownerDescription')}</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0',
                getRoleColor('admin')
              )}
            >
              {getRoleIcon('admin')}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[var(--text-primary)]">{t('settings.roles.admin')}</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{t('settings.roles.adminDescription')}</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0',
                getRoleColor('viewer')
              )}
            >
              {getRoleIcon('viewer')}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[var(--text-primary)]">{t('settings.roles.viewer')}</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{t('settings.roles.viewerDescription')}</p>
            </div>
          </div>
          <div className="flex gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border-color)]">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0',
                getRoleColor('member')
              )}
            >
              {getRoleIcon('member')}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[var(--text-primary)]">{t('settings.roles.member')}</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{t('settings.roles.memberDescription')}</p>
            </div>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
