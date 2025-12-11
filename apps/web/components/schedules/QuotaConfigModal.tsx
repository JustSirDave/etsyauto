/**
 * Quota Configuration Modal
 * Allows admins to configure daily/weekly quotas for schedules
 */

import { useState } from 'react';
import { X, Settings, Save } from 'lucide-react';

interface QuotaConfigModalProps {
  scheduleId: number;
  scheduleName: string;
  currentDailyQuota: number;
  currentWeeklyQuota?: number | null;
  onClose: () => void;
  onSave: (dailyQuota: number, weeklyQuota: number | null) => Promise<void>;
}

export function QuotaConfigModal({
  scheduleId,
  scheduleName,
  currentDailyQuota,
  currentWeeklyQuota,
  onClose,
  onSave
}: QuotaConfigModalProps) {
  const [dailyQuota, setDailyQuota] = useState(currentDailyQuota || 150);
  const [weeklyQuota, setWeeklyQuota] = useState(currentWeeklyQuota || null);
  const [enableWeekly, setEnableWeekly] = useState(!!currentWeeklyQuota);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(dailyQuota, enableWeekly ? weeklyQuota : null);
      onClose();
    } catch (error) {
      console.error('Failed to save quota configuration:', error);
      alert('Failed to save quota configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Configure Quota</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{scheduleName}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Daily Quota */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daily Quota (Listings per Day)
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              value={dailyQuota}
              onChange={(e) => setDailyQuota(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: 150 listings/day. Premium users can set higher limits.
            </p>
          </div>

          {/* Weekly Quota Toggle */}
          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableWeekly}
                onChange={(e) => setEnableWeekly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable Weekly Limit
              </span>
            </label>
          </div>

          {/* Weekly Quota Input */}
          {enableWeekly && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weekly Quota (Listings per Week)
              </label>
              <input
                type="number"
                min="0"
                max="5000"
                value={weeklyQuota || 500}
                onChange={(e) => setWeeklyQuota(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional weekly cap in addition to daily limit.
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 How Quotas Work</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Daily quota resets every 24 hours</li>
              <li>• Weekly quota (if enabled) resets every 7 days</li>
              <li>• Publishing pauses when quota is exceeded</li>
              <li>• Automatically resumes after reset</li>
              <li>• Premium users can set higher limits</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

