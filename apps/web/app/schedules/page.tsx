'use client';

/**
 * Schedules Page
 */

import { useState } from 'react';
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
  MoreVertical,
  RefreshCw,
  Zap,
  Timer,
} from 'lucide-react';

// Schedule Item Component
function ScheduleItem({
  name,
  type,
  frequency,
  nextRun,
  lastRun,
  status,
}: {
  name: string;
  type: 'sync' | 'generate' | 'backup' | 'report';
  frequency: string;
  nextRun: string;
  lastRun: string;
  status: 'active' | 'paused' | 'error';
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

  const StatusIcon = statusIcons[status];

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--primary)]/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${typeColors[type]} flex items-center justify-center`}>
          {type === 'sync' && <RefreshCw className="w-6 h-6" />}
          {type === 'generate' && <Zap className="w-6 h-6" />}
          {type === 'backup' && <Clock className="w-6 h-6" />}
          {type === 'report' && <Calendar className="w-6 h-6" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-[var(--text-primary)] font-semibold">{name}</h4>
            <span className={`flex items-center gap-1 text-sm ${statusColors[status]}`}>
              <StatusIcon className="w-4 h-4" />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">{frequency}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[var(--text-secondary)] text-sm">Next Run</p>
          <p className="text-[var(--text-primary)] font-medium">{nextRun}</p>
        </div>
        <div className="text-right">
          <p className="text-[var(--text-secondary)] text-sm">Last Run</p>
          <p className="text-[var(--text-muted)]">{lastRun}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] rounded-lg transition-colors">
            {status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] rounded-lg transition-colors">
            <Edit className="w-5 h-5" />
          </button>
          <button className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Upcoming Run Item
function UpcomingRun({
  name,
  time,
  type,
}: {
  name: string;
  time: string;
  type: 'sync' | 'generate' | 'backup' | 'report';
}) {
  const typeColors = {
    sync: 'text-[var(--primary)]',
    generate: 'text-[var(--info)]',
    backup: 'text-[var(--success)]',
    report: 'text-[var(--warning)]',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
        <span className="text-[var(--text-primary)]">{name}</span>
      </div>
      <span className={`text-sm font-medium ${typeColors[type]}`}>{time}</span>
    </div>
  );
}

export default function SchedulesPage() {
  const [filter, setFilter] = useState('all');

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
          <button className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-white font-semibold rounded-lg hover:opacity-90 transition shadow-lg shadow-[var(--primary)]/25">
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
                <p className="text-2xl font-bold text-[var(--text-primary)]">12</p>
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
                <p className="text-2xl font-bold text-[var(--text-primary)]">8</p>
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
                <p className="text-2xl font-bold text-[var(--text-primary)]">3</p>
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
                <p className="text-2xl font-bold text-[var(--text-primary)]">247</p>
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
                  {['all', 'active', 'paused'].map((f) => (
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
              <div className="space-y-3">
                <ScheduleItem
                  name="Product Sync"
                  type="sync"
                  frequency="Every 6 hours"
                  nextRun="In 2 hours"
                  lastRun="4 hours ago"
                  status="active"
                />
                <ScheduleItem
                  name="AI Title Generation"
                  type="generate"
                  frequency="Daily at 9:00 AM"
                  nextRun="Tomorrow 9:00 AM"
                  lastRun="Today 9:00 AM"
                  status="active"
                />
                <ScheduleItem
                  name="Inventory Backup"
                  type="backup"
                  frequency="Weekly on Sunday"
                  nextRun="Sunday 2:00 AM"
                  lastRun="Last Sunday"
                  status="active"
                />
                <ScheduleItem
                  name="Sales Report"
                  type="report"
                  frequency="Monthly"
                  nextRun="Dec 1, 2024"
                  lastRun="Nov 1, 2024"
                  status="paused"
                />
                <ScheduleItem
                  name="Price Optimization"
                  type="generate"
                  frequency="Every 12 hours"
                  nextRun="In 8 hours"
                  lastRun="Failed"
                  status="error"
                />
              </div>
            </DashboardCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Upcoming Runs */}
            <DashboardCard title="Upcoming Runs" subtitle="Next 24 hours">
              <UpcomingRun name="Product Sync" time="2:00 PM" type="sync" />
              <UpcomingRun name="Price Check" time="6:00 PM" type="generate" />
              <UpcomingRun name="Inventory Sync" time="8:00 PM" type="sync" />
              <UpcomingRun name="AI Titles" time="9:00 AM" type="generate" />
              <UpcomingRun name="Daily Backup" time="2:00 AM" type="backup" />
            </DashboardCard>

            {/* Quick Actions */}
            <DashboardCard title="Quick Actions">
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                  <RefreshCw className="w-5 h-5" />
                  <span>Run All Syncs Now</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                  <Pause className="w-5 h-5" />
                  <span>Pause All Schedules</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                  <Calendar className="w-5 h-5" />
                  <span>View Calendar</span>
                </button>
              </div>
            </DashboardCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
