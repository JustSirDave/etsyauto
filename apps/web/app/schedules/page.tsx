'use client';

/**
 * Schedules Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { schedulesApi, shopsApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { AddButton } from '@/components/ui/DataTable';
import { Play, Pause, Trash2, Clock, X } from 'lucide-react';

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

function SchedulesContent() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ shop_id: '', name: '', frequency: 'daily', daily_quota: 10, time_slots: ['09:00', '12:00', '15:00'] });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, shopsRes] = await Promise.all([schedulesApi.getAll(), shopsApi.getAll()]);
      setSchedules(schedulesRes.schedules);
      setShops(shopsRes);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await schedulesApi.create({ shop_id: parseInt(formData.shop_id), name: formData.name, frequency: formData.frequency, daily_quota: formData.daily_quota, time_slots: formData.time_slots });
      setShowCreateModal(false);
      setFormData({ shop_id: '', name: '', frequency: 'daily', daily_quota: 10, time_slots: ['09:00', '12:00', '15:00'] });
      await loadData();
    } catch (error: any) {
      alert(`Create failed: ${error.detail || error.message}`);
    }
  };

  const handleToggle = async (id: number) => { try { await schedulesApi.toggle(id); await loadData(); } catch (error) { console.error(error); } };
  const handleDelete = async (id: number) => { if (!confirm('Delete?')) return; try { await schedulesApi.delete(id); await loadData(); } catch (error) { console.error(error); } };

  const activeSchedules = schedules.filter(s => s.is_active).length;
  const totalQuota = schedules.reduce((sum, s) => sum + (s.is_active ? s.daily_quota : 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Schedules</h1>
          <p className="text-[var(--text-muted)] mt-1">Automate your Etsy listing publication</p>
        </div>
        <AddButton label="Create Schedule" onClick={() => setShowCreateModal(true)} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Total Schedules</p>
          <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{schedules.length}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Active Schedules</p>
          <p className="text-3xl font-bold text-[var(--success)] mt-1">{activeSchedules}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Daily Quota</p>
          <p className="text-3xl font-bold text-[var(--primary)] mt-1">{totalQuota} listings/day</p>
        </div>
      </div>

      {/* List */}
      <DashboardCard noPadding>
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">No schedules found. Create your first schedule.</div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {schedules.map(schedule => {
              const shop = shops.find(s => s.id === schedule.shop_id);
              return (
                <div key={schedule.id} className="p-6 hover:bg-[var(--background)] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{schedule.name}</h3>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${schedule.is_active ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--background)] text-[var(--text-muted)]'}`}>
                          {schedule.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-[var(--text-muted)] text-sm mt-1">{shop?.display_name || `Shop #${schedule.shop_id}`}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div><p className="text-[var(--text-muted)] text-xs">Frequency</p><p className="text-[var(--text-primary)] font-medium mt-1 capitalize">{schedule.frequency}</p></div>
                        <div><p className="text-[var(--text-muted)] text-xs">Daily Quota</p><p className="text-[var(--text-primary)] font-medium mt-1">{schedule.daily_quota} listings</p></div>
                        <div><p className="text-[var(--text-muted)] text-xs">Time Slots</p><p className="text-[var(--text-primary)] font-medium mt-1">{schedule.time_slots.length} times/day</p></div>
                        <div><p className="text-[var(--text-muted)] text-xs">Next Run</p><p className="text-[var(--text-primary)] font-medium mt-1">{schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'Not scheduled'}</p></div>
                      </div>
                      <div className="mt-4">
                        <p className="text-[var(--text-muted)] text-xs mb-2">Time Slots</p>
                        <div className="flex flex-wrap gap-2">
                          {schedule.time_slots.map((slot, i) => (
                            <span key={i} className="px-3 py-1 bg-[var(--background)] text-[var(--text-secondary)] rounded-lg text-sm font-mono">
                              <Clock className="w-3 h-3 inline mr-1" />{slot}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => handleToggle(schedule.id)} className={`p-2.5 rounded-lg transition-colors ${schedule.is_active ? 'bg-[var(--warning-bg)] text-[var(--warning)]' : 'bg-[var(--success-bg)] text-[var(--success)]'}`}>
                        {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(schedule.id)} className="p-2.5 bg-[var(--danger-bg)] text-[var(--danger)] rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Schedule</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" placeholder="Daily Listings" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Shop</label>
                <select value={formData.shop_id} onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                  <option value="">Select a shop</option>
                  {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Daily Quota</label>
                <input type="number" min="1" max="100" value={formData.daily_quota} onChange={(e) => setFormData({ ...formData, daily_quota: parseInt(e.target.value) })} className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={!formData.name || !formData.shop_id} className="flex-1 px-4 py-3 gradient-primary text-white rounded-lg disabled:opacity-50 shadow-lg shadow-[var(--primary)]/25">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulesPage() {
  return (
    <DashboardLayout>
      <SchedulesContent />
    </DashboardLayout>
  );
}
