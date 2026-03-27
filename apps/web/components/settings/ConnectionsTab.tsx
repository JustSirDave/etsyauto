'use client';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Building2 } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import type { User } from '@/lib/api';

export interface ConnectionsTabProps {
  user: User | null | undefined;
  shops?: unknown;
  onShopConnected?: () => void;
  toast?: unknown;
}

export function ConnectionsTab({ user }: ConnectionsTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <DashboardCard>
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('settings.organization')}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[var(--text-muted)]">{t('common.name')}</p>
            <p className="text-[var(--text-primary)] font-medium">{user?.tenant_name}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">{t('settings.yourRole')}</p>
            <p className="text-[var(--text-primary)] font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
