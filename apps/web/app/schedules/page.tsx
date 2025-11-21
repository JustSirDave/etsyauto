'use client';

/**
 * Schedules Management Page
 * Create and manage automated listing schedules
 */

import { useState, useEffect } from 'react';
import { schedulesApi, shopsApi } from '@/lib/api';
import { Plus, Play, Pause, Trash2, Clock, Calendar } from 'lucide-react';

interface Schedule {
  id: number;
  shop_id: number;
  name: string;
  frequency: string;
  daily_quota: number;
  time_slots: string[];
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

interface Shop {
  id: number;
  etsy_shop_id: string;
  display_name: string;
  status: string;
  created_at: string;
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    shop_id: '',
    name: '',
    frequency: 'daily',
    daily_quota: 10,
    time_slots: ['09:00', '12:00', '15:00'],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, shopsRes] = await Promise.all([
        schedulesApi.getAll(),
        shopsApi.getAll(),
      ]);
      setSchedules(schedulesRes.schedules);
      setShops(shopsRes);
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await schedulesApi.create({
        shop_id: parseInt(formData.shop_id),
        name: formData.name,
        frequency: formData.frequency,
        daily_quota: formData.daily_quota,
        time_slots: formData.time_slots,
      });
      setShowCreateModal(false);
      setFormData({
        shop_id: '',
        name: '',
        frequency: 'daily',
        daily_quota: 10,
        time_slots: ['09:00', '12:00', '15:00'],
      });
      await loadData();
    } catch (error: any) {
      console.error('Create failed:', error);
      alert(`Create failed: ${error.detail || error.message}`);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await schedulesApi.toggle(id);
      await loadData();
    } catch (error: any) {
      console.error('Toggle failed:', error);
      alert(`Toggle failed: ${error.detail || error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this schedule?')) return;

    try {
      await schedulesApi.delete(id);
      await loadData();
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(`Delete failed: ${error.detail || error.message}`);
    }
  };

  const activeSchedules = schedules.filter(s => s.is_active).length;
  const totalQuota = schedules.reduce((sum, s) => sum + (s.is_active ? s.daily_quota : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Schedules</h1>
          <p className="text-slate-400 mt-1">
            Automate your Etsy listing publication with scheduled jobs
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Schedule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Total Schedules</div>
          <div className="text-2xl font-bold text-white mt-1">{schedules.length}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Active Schedules</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{activeSchedules}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Daily Quota</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">{totalQuota} listings/day</div>
        </div>
      </div>

      {/* Schedules List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-400">
            Loading schedules...
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-400">
            No schedules found. Create your first schedule to automate listings.
          </div>
        ) : (
          schedules.map(schedule => {
            const shop = shops.find(s => s.id === schedule.shop_id);

            return (
              <div
                key={schedule.id}
                className="bg-slate-800 rounded-lg p-6 border border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-white">{schedule.name}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          schedule.is_active
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {schedule.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                      {shop?.display_name || `Shop #${schedule.shop_id}`}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-slate-500 text-xs">Frequency</div>
                        <div className="text-white font-medium mt-1 capitalize">
                          {schedule.frequency}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Daily Quota</div>
                        <div className="text-white font-medium mt-1">
                          {schedule.daily_quota} listings
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Time Slots</div>
                        <div className="text-white font-medium mt-1">
                          {schedule.time_slots.length} times/day
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Next Run</div>
                        <div className="text-white font-medium mt-1">
                          {schedule.next_run
                            ? new Date(schedule.next_run).toLocaleString()
                            : 'Not scheduled'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-slate-500 text-xs mb-2">Time Slots</div>
                      <div className="flex flex-wrap gap-2">
                        {schedule.time_slots.map((slot, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm font-mono"
                          >
                            <Clock className="w-3 h-3 inline mr-1" />
                            {slot}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggle(schedule.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        schedule.is_active
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                      title={schedule.is_active ? 'Pause' : 'Activate'}
                    >
                      {schedule.is_active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Create Schedule</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Schedule Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Daily Listings"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Shop
                </label>
                <select
                  value={formData.shop_id}
                  onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a shop</option>
                  {shops.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      {shop.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Daily Quota
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.daily_quota}
                  onChange={(e) =>
                    setFormData({ ...formData, daily_quota: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-slate-500 text-xs mt-1">
                  Number of listings to publish per day (1-100)
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.name || !formData.shop_id}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
