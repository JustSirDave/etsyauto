'use client';

/**
 * Dashboard Page - Two Column Layout
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import OnboardingModal from '@/components/OnboardingModal';
import { onboardingApi, shopsApi } from '@/lib/api';
import {
  DollarSign,
  Package,
  ShoppingCart,
  Star,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Sparkles,
  Calendar,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  change,
  changeType,
  icon: Icon,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  changeType?: 'up' | 'down';
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[var(--text-muted)] text-sm">{title}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
          {(subtitle || change) && (
            <div className="flex items-center gap-2 mt-1">
              {subtitle && <span className="text-sm text-[var(--text-muted)]">{subtitle}</span>}
              {change && (
                <span className={`flex items-center gap-0.5 text-sm font-medium ${changeType === 'up' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {changeType === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {change}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// Welcome Handler Component
function WelcomeHandler() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      showToast('Welcome! Your account has been created successfully.', 'success');
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams, showToast]);

  return null;
}

// Transaction Row Component
function TransactionRow({ id, customer, amount, status }: { id: string; customer: string; amount: string; status: 'paid' | 'pending' | 'refunded' }) {
  const statusStyles = {
    paid: 'bg-[var(--success-bg)] text-[var(--success)]',
    pending: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    refunded: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm">
          {customer.charAt(0)}
        </div>
        <div>
          <p className="text-[var(--text-primary)] font-medium">{customer}</p>
          <p className="text-[var(--text-muted)] text-sm">{id}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[var(--text-primary)] font-medium">{amount}</p>
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  );
}

function DashboardContent() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);

  useEffect(() => {
    if (user && !user.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      setLoadingShops(true);
      const data = await shopsApi.getAll();
      setShops(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load shops:', error);
      setShops([]);
    } finally {
      setLoadingShops(false);
    }
  };

  const handleCompleteOnboarding = async (shopName: string, description: string | null) => {
    try {
      await onboardingApi.complete(shopName, description);
      showToast('Shop setup complete!', 'success');
      setUser((prev: any) => prev ? { ...prev, tenant_name: shopName, onboarding_completed: true } : null);
      setShowOnboarding(false);
    } catch (error: any) {
      showToast(error.detail || 'Failed to complete onboarding', 'error');
      throw error;
    }
  };

  const handleSkipOnboarding = async () => {
    try {
      await onboardingApi.complete(user?.tenant_name || 'My Shop', null);
      setUser((prev: any) => prev ? { ...prev, onboarding_completed: true } : null);
      showToast('You can complete setup anytime from Settings', 'info');
      setShowOnboarding(false);
    } catch (error: any) {
      showToast(error.detail || 'Failed to skip', 'error');
    }
  };

  const etsyShop = shops.find((s) => s.status === 'connected');

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Suspense fallback={null}>
        <WelcomeHandler />
      </Suspense>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋
        </h1>
        <p className="text-[var(--text-muted)] mt-1">Here's what's happening with your shop today</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Connection Status & Quick Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* Shop Connection Status */}
          <DashboardCard title="Shop Connection" subtitle="Etsy Integration">
            {loadingShops ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : etsyShop ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-xl bg-[var(--success-bg)] flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[var(--success)]" />
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-semibold">{etsyShop.display_name}</p>
                  <p className="text-[var(--success)] text-sm">Connected</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-xl bg-[var(--danger-bg)] flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-[var(--danger)]" />
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-semibold">No Shop Connected</p>
                  <p className="text-[var(--text-muted)] text-sm">Connect your Etsy shop to get started</p>
                </div>
              </div>
            )}
            {!etsyShop && !loadingShops && (
              <a
                href="/settings"
                className="mt-4 w-full py-2.5 gradient-primary text-white font-medium rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                Connect Etsy Shop
              </a>
            )}
          </DashboardCard>

          {/* Quick Actions */}
          <DashboardCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/products"
                className="flex flex-col items-center justify-center p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors group"
              >
                <Package className="w-6 h-6 text-[var(--primary)] mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-[var(--text-primary)] font-medium">Products</span>
              </a>
              <a
                href="/ai"
                className="flex flex-col items-center justify-center p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--info)] hover:bg-[var(--info-bg)] transition-colors group"
              >
                <Sparkles className="w-6 h-6 text-[var(--info)] mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-[var(--text-primary)] font-medium">AI Gen</span>
              </a>
              <a
                href="/schedules"
                className="flex flex-col items-center justify-center p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--warning)] hover:bg-[var(--warning-bg)] transition-colors group"
              >
                <Calendar className="w-6 h-6 text-[var(--warning)] mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-[var(--text-primary)] font-medium">Schedules</span>
              </a>
              <a
                href="/listings"
                className="flex flex-col items-center justify-center p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--success)] hover:bg-[var(--success-bg)] transition-colors group"
              >
                <FileText className="w-6 h-6 text-[var(--success)] mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-[var(--text-primary)] font-medium">Listings</span>
              </a>
              <a
                href="/settings"
                className="flex flex-col items-center justify-center p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-xl hover:border-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] transition-colors group col-span-2"
              >
                <Settings className="w-6 h-6 text-[var(--text-muted)] mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-[var(--text-primary)] font-medium">Settings</span>
              </a>
            </div>
          </DashboardCard>
        </div>

        {/* Right Column - Key Metrics & Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatsCard
              title="Total Revenue"
              value="$45,385"
              subtitle="This month"
              change="+12.5%"
              changeType="up"
              icon={DollarSign}
              iconBg="gradient-success"
            />
            <StatsCard
              title="Total Orders"
              value="1,247"
              subtitle="This month"
              change="+8.2%"
              changeType="up"
              icon={ShoppingCart}
              iconBg="gradient-primary"
            />
            <StatsCard
              title="Active Listings"
              value="156"
              subtitle="Currently live"
              change="+3.1%"
              changeType="up"
              icon={Package}
              iconBg="gradient-info"
            />
            <StatsCard
              title="Shop Rating"
              value="4.9 ⭐"
              subtitle="From 2,453 reviews"
              change="-0.1"
              changeType="down"
              icon={Star}
              iconBg="gradient-warning"
            />
          </div>

          {/* Revenue Overview */}
          <DashboardCard
            title="Revenue Overview"
            subtitle="Monthly breakdown"
            action={
              <button className="p-2 hover:bg-[var(--background)] rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            }
          >
            <div className="h-64 flex items-center justify-center border border-dashed border-[var(--border-color)] rounded-xl text-[var(--text-muted)]">
              Revenue Chart Placeholder
            </div>
          </DashboardCard>

          {/* Recent Transactions */}
          <DashboardCard
            title="Recent Transactions"
            subtitle="Latest orders"
            action={
              <a href="/orders" className="text-sm text-[var(--primary)] hover:underline">
                View All
              </a>
            }
          >
            <TransactionRow id="#ORD-7234" customer="Sarah Wilson" amount="$125.00" status="paid" />
            <TransactionRow id="#ORD-7233" customer="Mike Johnson" amount="$89.99" status="pending" />
            <TransactionRow id="#ORD-7232" customer="Emma Davis" amount="$234.50" status="paid" />
            <TransactionRow id="#ORD-7231" customer="James Brown" amount="$45.00" status="refunded" />
          </DashboardCard>
        </div>
      </div>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleCompleteOnboarding}
        onSkip={handleSkipOnboarding}
        currentShopName={user?.tenant_name}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
