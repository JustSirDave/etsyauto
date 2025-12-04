'use client';

/**
 * Dashboard Page - Redesigned Layout
 * Left: 40% (Connection Status + Quick Actions)
 * Right: 60% (Key Metrics 2x2)
 * Full Width: Recent Transactions
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import OnboardingModal from '@/components/OnboardingModal';
import { onboardingApi, shopsApi } from '@/lib/api';
import {
  Package,
  Users,
  ShoppingCart,
  FileText,
  CheckCircle,
  XCircle,
  Upload,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Link as LinkIcon,
} from 'lucide-react';

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

// Connection Item Component (Compact for side-by-side)
function ConnectionItem({
  name,
  status,
  storeName,
  onConnect,
}: {
  name: string;
  status: 'connected' | 'disconnected';
  storeName?: string;
  onConnect?: () => void;
}) {
  const isConnected = status === 'connected';

  return (
    <div className="flex-1 p-3 bg-[var(--background)] rounded-lg border border-[var(--border-color)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-[var(--success-bg)]' : 'bg-[var(--danger-bg)]'}`}>
            {isConnected ? (
              <CheckCircle className="w-4 h-4 text-[var(--success)]" />
            ) : (
              <XCircle className="w-4 h-4 text-[var(--danger)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[var(--text-primary)] font-medium text-sm truncate">{name}</p>
            {isConnected ? (
              <p className="text-[var(--success)] text-xs truncate">{storeName || 'Connected'}</p>
            ) : (
              <p className="text-[var(--danger)] text-xs">Not Connected</p>
            )}
          </div>
        </div>
        {!isConnected && (
          <button
            onClick={onConnect}
            className="px-2.5 py-1 bg-[var(--danger)] hover:bg-[var(--danger)]/80 text-white text-xs font-medium rounded-md transition-colors flex-shrink-0"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({
  icon: Icon,
  label,
  subtitle,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subtitle: string;
  href: string;
  color: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col p-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/10 transition-all duration-200 group"
    >
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-[var(--text-primary)] font-medium text-sm">{label}</p>
      <p className="text-[var(--text-muted)] text-xs">{subtitle}</p>
    </a>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  value,
  label,
  change,
  iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  change: number;
  iconBg: string;
}) {
  const isPositive = change >= 0;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPositive ? '+' : ''}{change}%
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)] mb-0.5">{value}</p>
      <p className="text-[var(--text-muted)] text-sm">{label}</p>
    </div>
  );
}

// Transaction Row Component
function TransactionRow({
  orderId,
  customer,
  date,
  amount,
  status,
  onMessage,
}: {
  orderId: string;
  customer: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'refunded' | 'processing';
  onMessage: () => void;
}) {
  const statusStyles = {
    paid: 'bg-[var(--success-bg)] text-[var(--success)]',
    pending: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    refunded: 'bg-[var(--danger-bg)] text-[var(--danger)]',
    processing: 'bg-[var(--info-bg)] text-[var(--info)]',
  };

  const statusLabels = {
    paid: 'Paid',
    pending: 'Pending',
    refunded: 'Refunded',
    processing: 'Processing',
  };

  return (
    <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto_auto] gap-4 items-center py-4 border-b border-[var(--border-color)] last:border-0">
      <div className="text-left">
        <p className="text-[var(--text-primary)] font-medium">{orderId}</p>
      </div>
      <div className="flex items-center gap-3 text-left">
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {customer.charAt(0).toUpperCase()}
        </div>
        <p className="text-[var(--text-primary)]">{customer}</p>
      </div>
      <div className="text-left">
        <p className="text-[var(--text-muted)]">{date}</p>
      </div>
      <div className="text-left">
        <p className="text-[var(--text-primary)] font-semibold">{amount}</p>
      </div>
      <div className="text-left">
        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
      <div className="text-left">
        <button
          onClick={onMessage}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Message
        </button>
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

  const handleMessageCustomer = (customer: string) => {
    showToast(`Opening message interface for ${customer}...`, 'info');
  };

  const etsyShop = shops.find((s) => s.status === 'connected');

  // Mock data for metrics (replace with real API data)
  const metrics = {
    totalProducts: 0,
    totalCustomers: 0,
    totalOrders: 0,
    activeListings: 0,
  };

  // Mock transactions (replace with real API data)
  const transactions = [
    { orderId: 'ETSY001', customer: 'John Doe', date: '2025-10-17', amount: '$125.00', status: 'processing' as const },
    { orderId: 'ETSY002', customer: 'Sarah Wilson', date: '2025-10-16', amount: '$89.99', status: 'paid' as const },
    { orderId: 'ETSY003', customer: 'Mike Johnson', date: '2025-10-15', amount: '$234.50', status: 'paid' as const },
    { orderId: 'ETSY004', customer: 'Emma Davis', date: '2025-10-14', amount: '$45.00', status: 'pending' as const },
    { orderId: 'ETSY005', customer: 'James Brown', date: '2025-10-13', amount: '$178.00', status: 'refunded' as const },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Suspense fallback={null}>
        <WelcomeHandler />
      </Suspense>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-[var(--text-muted)] mt-1">Welcome back! Here's your shop overview.</p>
      </div>

      {/* Main Grid: Left / Right - Aligned Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="grid grid-rows-2 gap-4">
          {/* Connection Status Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 pt-4 pb-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">Connection Status</h2>
            {loadingShops ? (
              <div className="flex items-center justify-center py-2">
                <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex gap-3">
                <ConnectionItem
                  name="Etsy Shop"
                  status={etsyShop ? 'connected' : 'disconnected'}
                  storeName={etsyShop?.display_name || user?.tenant_name}
                  onConnect={() => window.location.href = '/settings'}
                />
                <ConnectionItem
                  name="Supplier API"
                  status="disconnected"
                  onConnect={() => showToast('Supplier API connection coming soon!', 'info')}
                />
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 pt-4 pb-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <QuickActionButton
                icon={Upload}
                label="Import Products"
                subtitle="Upload CSV"
                href="/products/import"
                color="bg-[var(--primary)]"
              />
              <QuickActionButton
                icon={Sparkles}
                label="AI Content"
                subtitle="Generate"
                href="/ai"
                color="bg-[var(--info)]"
              />
              <QuickActionButton
                icon={LinkIcon}
                label="Connect Etsy"
                subtitle="Link shop"
                href="/settings"
                color="bg-[var(--success)]"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Key Metrics 2x2 Grid */}
        <div className="grid grid-cols-2 grid-rows-2 gap-4">
          <MetricCard
            icon={Package}
            value={metrics.totalProducts}
            label="Total Products"
            change={12}
            iconBg="bg-[var(--primary)]"
          />
          <MetricCard
            icon={Users}
            value={metrics.totalCustomers}
            label="Total Customers"
            change={8}
            iconBg="bg-[var(--info)]"
          />
          <MetricCard
            icon={ShoppingCart}
            value={metrics.totalOrders}
            label="Total Orders"
            change={15}
            iconBg="bg-[var(--warning)]"
          />
          <MetricCard
            icon={FileText}
            value={metrics.activeListings}
            label="Active Listings"
            change={5}
            iconBg="bg-[var(--success)]"
          />
        </div>
      </div>

      {/* Full Width - Recent Transactions */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Transactions</h2>
            <p className="text-[var(--text-muted)] text-sm">Latest customer transactions</p>
          </div>
          <a
            href="/orders"
            className="text-[var(--primary)] hover:underline text-sm font-medium"
          >
            View All
          </a>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto_auto] gap-4 pb-3 border-b border-[var(--border-color)] text-sm font-medium text-[var(--text-muted)]">
          <div className="text-left">Order ID</div>
          <div className="text-left">Customer</div>
          <div className="text-left">Date</div>
          <div className="text-left">Amount</div>
          <div className="text-left">Status</div>
          <div className="text-left">Actions</div>
        </div>

        {/* Transaction Rows */}
        <div>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.orderId}
              orderId={transaction.orderId}
              customer={transaction.customer}
              date={transaction.date}
              amount={transaction.amount}
              status={transaction.status}
              onMessage={() => handleMessageCustomer(transaction.customer)}
            />
          ))}
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
