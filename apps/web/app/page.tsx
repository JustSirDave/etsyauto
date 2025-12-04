'use client';

/**
 * Dashboard Page - Vuexy Style
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import OnboardingModal from '@/components/OnboardingModal';
import { onboardingApi } from '@/lib/api';
import {
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  Star,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from 'lucide-react';

// Stats Card
function StatsCard({
  title,
  value,
  subtitle,
  change,
  changeType,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  changeType?: 'up' | 'down';
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
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
        <div className={`w-12 h-12 rounded-lg ${iconColor} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// Welcome Handler
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

// Product Row
function ProductRow({ name, category, sales, revenue }: { name: string; category: string; sales: number; revenue: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center">
          <Package className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-[var(--text-primary)] font-medium">{name}</p>
          <p className="text-[var(--text-muted)] text-sm">{category}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[var(--text-primary)] font-medium">{revenue}</p>
        <p className="text-[var(--text-muted)] text-sm">{sales} sold</p>
      </div>
    </div>
  );
}

// Transaction Row
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

  useEffect(() => {
    if (user && !user.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user]);

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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Revenue" value="$45,385" subtitle="This month" change="+12.5%" changeType="up" icon={DollarSign} iconColor="gradient-success" />
        <StatsCard title="Total Orders" value="1,247" subtitle="This month" change="+8.2%" changeType="up" icon={ShoppingCart} iconColor="gradient-primary" />
        <StatsCard title="Total Customers" value="3,842" subtitle="Active" change="+5.7%" changeType="up" icon={Users} iconColor="gradient-info" />
        <StatsCard title="Average Rating" value="4.8" subtitle="From 2,453 reviews" change="-0.1" changeType="down" icon={Star} iconColor="gradient-warning" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardCard title="Revenue Overview" subtitle="Monthly breakdown" className="lg:col-span-2" action={<button className="p-2 hover:bg-[var(--background)] rounded-lg"><MoreVertical className="w-5 h-5 text-[var(--text-muted)]" /></button>}>
          <div className="h-64 flex items-center justify-center border border-dashed border-[var(--border-color)] rounded-lg text-[var(--text-muted)]">
            Revenue Chart Placeholder
          </div>
        </DashboardCard>

        <DashboardCard title="Earnings" subtitle="This month">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-[var(--text-primary)]">$15,420</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Total Earnings</p>
            </div>
            <div className="h-32 flex items-center justify-center border border-dashed border-[var(--border-color)] rounded-lg text-[var(--text-muted)] text-sm">
              Donut Chart
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div><p className="text-[var(--text-primary)] font-semibold">$12,340</p><p className="text-[var(--text-muted)] text-xs">Income</p></div>
              <div><p className="text-[var(--text-primary)] font-semibold">$3,080</p><p className="text-[var(--text-muted)] text-xs">Expenses</p></div>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Popular Products" subtitle="Best selling items" action={<a href="/products" className="text-sm text-[var(--primary)] hover:underline">View All</a>}>
          <ProductRow name="Handmade Silver Ring" category="Jewelry" sales={142} revenue="$6,530" />
          <ProductRow name="Vintage Leather Wallet" category="Accessories" sales={98} revenue="$8,722" />
          <ProductRow name="Custom Photo Frame" category="Home Decor" sales={87} revenue="$3,006" />
          <ProductRow name="Ceramic Plant Pot" category="Home Decor" sales={76} revenue="$2,128" />
        </DashboardCard>

        <DashboardCard title="Recent Transactions" subtitle="Latest orders" action={<a href="/orders" className="text-sm text-[var(--primary)] hover:underline">View All</a>}>
          <TransactionRow id="#ORD-7234" customer="Sarah Wilson" amount="$125.00" status="paid" />
          <TransactionRow id="#ORD-7233" customer="Mike Johnson" amount="$89.99" status="pending" />
          <TransactionRow id="#ORD-7232" customer="Emma Davis" amount="$234.50" status="paid" />
          <TransactionRow id="#ORD-7231" customer="James Brown" amount="$45.00" status="refunded" />
        </DashboardCard>
      </div>

      <OnboardingModal isOpen={showOnboarding} onComplete={handleCompleteOnboarding} onSkip={handleSkipOnboarding} currentShopName={user?.tenant_name} />
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
