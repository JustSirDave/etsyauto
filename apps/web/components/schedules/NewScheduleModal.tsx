'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, RefreshCw, Clock } from 'lucide-react';
import { schedulesApi, ScheduleCreate, shopsApi, Shop } from '@/lib/api';

interface NewScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  defaultShopId?: number | null;
}

export function NewScheduleModal({ isOpen, onClose, onSuccess, showToast, defaultShopId }: NewScheduleModalProps) {
  const [formData, setFormData] = useState<ScheduleCreate>({
    name: '',
    description: '',
    type: 'sync',
    cron_expr: '0 */6 * * *', // Every 6 hours by default
    daily_quota: 0,
    shop_id: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // Load shops when modal opens
  useEffect(() => {
    if (isOpen) {
      loadShops();
    }
  }, [isOpen]);

  const loadShops = async () => {
    try {
      setLoadingShops(true);
      const data = await shopsApi.getAll();
      setShops(data);
      // Set first shop as default if available
      if (data.length > 0 && !formData.shop_id) {
        const nextShopId = defaultShopId && data.some((shop) => shop.id === defaultShopId)
          ? defaultShopId
          : data[0].id;
        setFormData(prev => ({ ...prev, shop_id: nextShopId }));
      }
    } catch (err: any) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoadingShops(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Please enter a schedule name');
      return;
    }

    if (!formData.cron_expr.trim()) {
      setError('Please enter a cron expression');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await schedulesApi.create(formData);
      showToast(result.message || 'Schedule created successfully', 'success');
      handleClose();
      onSuccess();
    } catch (err: any) {
      const errorMsg = err.detail || 'Failed to create schedule';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        name: '',
        description: '',
        type: 'sync',
        cron_expr: '0 */6 * * *',
        daily_quota: 0,
        shop_id: undefined,
      });
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const scheduleTypes = [
    { value: 'sync', label: 'Sync', icon: RefreshCw, description: 'Synchronize data from Etsy' },
    { value: 'backup', label: 'Backup', icon: Clock, description: 'Data backup and archival' },
    { value: 'report', label: 'Report', icon: Calendar, description: 'Generate reports and analytics' },
  ];

  const cronPresets = [
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every 12 hours', value: '0 */12 * * *' },
    { label: 'Daily at 9:00 AM', value: '0 9 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Weekly on Sunday', value: '0 2 * * 0' },
    { label: 'Monthly on 1st', value: '0 0 1 * *' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--card-bg)] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">New Schedule</h3>
              <p className="text-sm text-[var(--text-muted)]">Create an automated task schedule</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-[var(--danger-bg)] border border-[var(--danger)]/30 rounded-lg text-[var(--danger)] text-sm">
              {error}
            </div>
          )}

          {/* Schedule Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Schedule Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Daily Product Sync"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this schedule does..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Schedule Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {scheduleTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value as any })}
                    disabled={isSubmitting}
                    className={`p-3 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                      formData.type === type.value
                        ? 'border-[var(--primary)] bg-[var(--primary-bg)]'
                        : 'border-[var(--border-color)] bg-[var(--background)] hover:border-[var(--primary)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-[var(--text-primary)]">{type.label}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cron Expression */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Frequency (Cron Expression) *
            </label>
            <div className="space-y-2">
              <select
                value={formData.cron_expr}
                onChange={(e) => setFormData({ ...formData, cron_expr: e.target.value })}
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cronPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              {formData.cron_expr === 'custom' && (
                <input
                  type="text"
                  value={formData.cron_expr}
                  onChange={(e) => setFormData({ ...formData, cron_expr: e.target.value })}
                  placeholder="e.g., 0 */6 * * *"
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              )}
              <p className="text-xs text-[var(--text-muted)]">
                Current: {formData.cron_expr}
              </p>
            </div>
          </div>

          {/* Shop Selection (if type requires it) */}
          {(formData.type === 'sync' || formData.type === 'report') && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Shop (Optional)
              </label>
              {loadingShops ? (
                <div className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)]">
                  Loading shops...
                </div>
              ) : shops.length === 0 ? (
                <div className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)]">
                  No shops connected. Connect a shop first.
                </div>
              ) : (
                <select
                  value={formData.shop_id || ''}
                  onChange={(e) => setFormData({ ...formData, shop_id: e.target.value ? Number(e.target.value) : undefined })}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Shops</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.display_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Daily Quota */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Daily Quota (Optional)
            </label>
            <input
              type="number"
              value={formData.daily_quota}
              onChange={(e) => setFormData({ ...formData, daily_quota: Number(e.target.value) })}
              placeholder="0 for unlimited"
              min="0"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Maximum number of items to process per day (0 = unlimited)
            </p>
          </div>
        </form>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 bg-[var(--background)] border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg font-medium hover:bg-[var(--card-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 gradient-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

