/**
 * Quota Display Component
 * Shows quota usage, remaining, and reset times
 */

import { Clock, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface QuotaInfo {
  daily_quota: number;
  daily_used: number;
  daily_remaining: number;
  weekly_quota?: number | null;
  weekly_used?: number;
  weekly_remaining?: number | null;
  last_daily_reset?: string;
  last_weekly_reset?: string;
}

interface QuotaDisplayProps {
  quota: QuotaInfo;
  compact?: boolean;
}

export function QuotaDisplay({ quota, compact = false }: QuotaDisplayProps) {
  const dailyPercentage = quota.daily_quota > 0 
    ? (quota.daily_used / quota.daily_quota) * 100 
    : 0;
  
  const weeklyPercentage = quota.weekly_quota && quota.weekly_quota > 0
    ? ((quota.weekly_used || 0) / quota.weekly_quota) * 100
    : 0;
  
  const getQuotaColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600 bg-red-50';
    if (percentage >= 80) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  if (compact) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span className={`px-2 py-1 rounded-md ${getQuotaColor(dailyPercentage)}`}>
          {quota.daily_used}/{quota.daily_quota}
        </span>
        {quota.daily_remaining === 0 && (
          <span className="text-xs text-red-600 font-medium">Quota exceeded</span>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Daily Quota */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center text-sm font-medium text-gray-700">
            <Clock className="w-4 h-4 mr-2" />
            Daily Quota
          </div>
          <span className={`text-sm font-semibold px-2 py-1 rounded ${getQuotaColor(dailyPercentage)}`}>
            {quota.daily_used} / {quota.daily_quota}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getProgressColor(dailyPercentage)}`}
            style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
          <span>{quota.daily_remaining} remaining</span>
          {quota.last_daily_reset && (
            <span>Resets in {getTimeUntilReset(quota.last_daily_reset, 'daily')}</span>
          )}
        </div>
      </div>
      
      {/* Weekly Quota (if configured) */}
      {quota.weekly_quota && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-sm font-medium text-gray-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              Weekly Quota
            </div>
            <span className={`text-sm font-semibold px-2 py-1 rounded ${getQuotaColor(weeklyPercentage)}`}>
              {quota.weekly_used || 0} / {quota.weekly_quota}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(weeklyPercentage)}`}
              style={{ width: `${Math.min(weeklyPercentage, 100)}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
            <span>{quota.weekly_remaining} remaining</span>
            {quota.last_weekly_reset && (
              <span>Resets in {getTimeUntilReset(quota.last_weekly_reset, 'weekly')}</span>
            )}
          </div>
        </div>
      )}
      
      {/* Status Indicator */}
      <div className="pt-2 border-t">
        {quota.daily_remaining === 0 ? (
          <div className="flex items-center text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Daily quota exceeded - Publishing paused
          </div>
        ) : quota.daily_remaining < 10 ? (
          <div className="flex items-center text-sm text-yellow-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Low quota remaining ({quota.daily_remaining} left)
          </div>
        ) : (
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle className="w-4 h-4 mr-2" />
            Quota available ({quota.daily_remaining} remaining)
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeUntilReset(lastReset: string, type: 'daily' | 'weekly'): string {
  const lastResetDate = new Date(lastReset);
  const now = new Date();
  
  const resetInterval = type === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const nextReset = new Date(lastResetDate.getTime() + resetInterval);
  
  const diffMs = nextReset.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Soon';
  
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}

