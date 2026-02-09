'use client';

/**
 * Dashboard Page - Redesigned Layout
 * Left: 40% (Connection Status + Quick Actions)
 * Right: 60% (Key Metrics 2x2)
 * Full Width: Recent Transactions
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useLanguage } from '@/lib/language-context';
import { useShop } from '@/lib/shop-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import OnboardingModal from '@/components/OnboardingModal';
import { onboardingApi, dashboardApi, type DashboardStats, type DashboardOrder } from '@/lib/api';
import { PAYMENT_STATUS_STYLES, normalizePaymentStatus } from '@/lib/order-status';
import { cn } from '@/lib/utils';
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
  const { t } = useLanguage();

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      showToast(t('dashboard.welcomeToast'), 'success');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, showToast]);

  return null;
}

// Connection Item Component
function ConnectionItem({
  name,
  status,
  storeName,
  onConnect,
  connectedLabel,
  notConnectedLabel,
  connectLabel,
}: {
  name: string;
  status: 'connected' | 'disconnected';
  storeName?: string;
  onConnect?: () => void;
  connectedLabel: string;
  notConnectedLabel: string;
  connectLabel: string;
}) {
  const isConnected = status === 'connected';

  return (
    <div className="flex-1 p-4 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--primary-bg)]`}>
            {isConnected ? (
              <CheckCircle className="w-5 h-5 text-[var(--text-primary)]" />
            ) : (
              <XCircle className="w-5 h-5 text-[var(--text-muted)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[var(--text-primary)] font-medium truncate text-sm">{name}</p>
            {isConnected ? (
              <p className="text-[var(--text-secondary)] text-xs truncate">{storeName || connectedLabel}</p>
            ) : (
              <p className="text-[var(--text-muted)] text-xs">{notConnectedLabel}</p>
            )}
          </div>
        </div>
        {!isConnected && (
          <button
            onClick={onConnect}
            className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary)]/80 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
          >
            {connectLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// Quick Action Button Component
function QuickActionCard({
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
      className="flex flex-col p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl hover:border-[var(--primary)] hover:bg-[var(--card-bg-hover)] transition-all duration-200 group h-full"
    >
      <div className={`w-11 h-11 rounded-lg ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
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
  href,
  badgeCount,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  change: number;
  iconBg: string;
  href: string;
  badgeCount?: number;
}) {
  const isPositive = change >= 0;

  return (
    <Link
      href={href}
      className="relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5 h-full flex flex-col justify-between hover:border-[var(--primary)] hover:bg-[var(--card-bg-hover)] transition-colors"
    >
      {badgeCount && badgeCount > 0 && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-bg)] text-[var(--primary)]">
          {badgeCount}
        </span>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium text-[var(--text-muted)]`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPositive ? '+' : ''}{change}%
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-[var(--text-primary)] mb-1">{value}</p>
        <p className="text-[var(--text-muted)] text-sm">{label}</p>
      </div>
    </Link>
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
  statusLabels,
  messageLabel,
}: {
  orderId: string;
  customer: string;
  date: string;
  amount: string;
  status: 'paid' | 'unpaid';
  onMessage: () => void;
  statusLabels: Record<'paid' | 'unpaid', string>;
  messageLabel: string;
}) {
  const normalized = normalizePaymentStatus(status);
  const statusStyle = PAYMENT_STATUS_STYLES[normalized];

  return (
    <div className="grid grid-cols-[100px_1fr_120px_100px_100px_120px] gap-4 items-center py-4 border-b border-[var(--border-color)] last:border-0">
      <div>
        <p className="text-[var(--text-primary)] font-medium">{orderId}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {customer.charAt(0).toUpperCase()}
        </div>
        <p className="text-[var(--text-primary)]">{customer}</p>
      </div>
      <div>
        <p className="text-[var(--text-muted)]">{date}</p>
      </div>
      <div>
        <p className="text-[var(--text-primary)] font-semibold">{amount}</p>
      </div>
      <div>
        <span className={cn('inline-flex px-3 py-1 rounded-full text-xs font-medium', statusStyle.bg, statusStyle.text)}>
          {statusLabels[normalized]}
        </span>
      </div>
      <div>
        <button
          onClick={onMessage}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {messageLabel}
        </button>
      </div>
    </div>
  );
}

function DashboardContent() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { shops, selectedShopId, selectedShop, isLoading: loadingShops } = useShop();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [metrics, setMetrics] = useState<DashboardStats | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [transactions, setTransactions] = useState<DashboardOrder[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    if (user && !user.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    loadMetrics();
    loadTransactions();
  }, [selectedShopId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadMetrics(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedShopId]);

  const loadMetrics = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoadingMetrics(true);
      }
      const data = await dashboardApi.getStats({ shopId: selectedShopId });
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      // Set default metrics on error
      setMetrics({
        total_products: 0,
        total_customers: 0,
        total_orders: 0,
        active_listings: 0,
        new_orders_unread: 0,
        changes: {
          products: 0,
          customers: 0,
          orders: 0,
          listings: 0,
        },
      });
    } finally {
      if (!silent) {
        setLoadingMetrics(false);
      }
    }
  };

  const loadTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const data = await dashboardApi.getRecentOrders(5, { shopId: selectedShopId });
      setTransactions(data.orders);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCompleteOnboarding = async (shopName: string, description: string | null) => {
    try {
      await onboardingApi.complete(shopName, description);
      showToast(t('dashboard.onboardingComplete'), 'success');
      setUser((prev: any) => prev ? { ...prev, tenant_name: shopName, onboarding_completed: true } : null);
      setShowOnboarding(false);
    } catch (error: any) {
      showToast(error.detail || t('dashboard.onboardingFailed'), 'error');
      throw error;
    }
  };

  const handleSkipOnboarding = async () => {
    try {
      await onboardingApi.complete(user?.tenant_name || 'My Shop', null);
      setUser((prev: any) => prev ? { ...prev, onboarding_completed: true } : null);
      showToast(t('dashboard.onboardingSkip'), 'info');
      setShowOnboarding(false);
    } catch (error: any) {
      showToast(error.detail || t('dashboard.onboardingSkipFailed'), 'error');
    }
  };

  const handleMessageCustomer = (customer: string) => {
    showToast(`${t('dashboard.messageOpening')} ${customer}...`, 'info');
  };

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <WelcomeHandler />
      </Suspense>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('dashboard.title')}</h1>
          <p className="text-[var(--text-muted)] mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Main Grid: Left (Connection Status + Quick Actions) / Right (KPIs) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start lg:items-stretch">
        {/* Left Column */}
        <div className="flex flex-col gap-4 min-w-0 h-full">
          {/* Connection Status Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">{t('dashboard.connectionStatus')}</h2>
            {loadingShops ? (
              <div className="flex items-center justify-center py-2">
                <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex gap-3">
                <ConnectionItem
                  name={t('dashboard.etsyShop')}
                  status={selectedShop ? 'connected' : 'disconnected'}
                  storeName={selectedShop?.display_name || user?.tenant_name}
                  onConnect={() => window.location.href = '/settings'}
                  connectedLabel={t('dashboard.connected')}
                  notConnectedLabel={t('dashboard.notConnected')}
                  connectLabel={t('dashboard.connect')}
                />
              </div>
            )}
          </div>

          {/* Quick Actions - Three Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <QuickActionCard
              icon={Upload}
              label={t('dashboard.action.importProducts')}
              subtitle={t('dashboard.action.importProductsSubtitle')}
              href="/products/import"
              color="bg-[var(--primary)]"
            />
            <QuickActionCard
              icon={Sparkles}
              label={t('dashboard.action.aiContent')}
              subtitle={t('dashboard.action.aiContentSubtitle')}
              href="/ai"
              color="bg-[var(--info)]"
            />
            <QuickActionCard
              icon={LinkIcon}
              label={t('dashboard.action.connectEtsy')}
              subtitle={t('dashboard.action.connectEtsySubtitle')}
              href="/settings"
              color="bg-[var(--success)]"
            />
          </div>
        </div>

        {/* Right Column - Key Metrics 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 min-w-0 h-full">
          {loadingMetrics ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <MetricCard
                icon={Package}
                value={metrics?.total_products || 0}
                label={t('dashboard.totalProducts')}
                change={metrics?.changes.products || 0}
                iconBg="bg-[var(--primary)]"
                href="/products"
              />
              <MetricCard
                icon={Users}
                value={metrics?.total_customers || 0}
                label={t('dashboard.totalCustomers')}
                change={metrics?.changes.customers || 0}
                iconBg="bg-[var(--info)]"
                href="/orders"
              />
              <MetricCard
                icon={ShoppingCart}
                value={metrics?.total_orders || 0}
                label={t('dashboard.totalOrders')}
                change={metrics?.changes.orders || 0}
                iconBg="bg-[var(--warning)]"
                href="/orders"
                badgeCount={metrics?.new_orders_unread || 0}
              />
              <MetricCard
                icon={FileText}
                value={metrics?.active_listings || 0}
                label={t('dashboard.activeListings')}
                change={metrics?.changes.listings || 0}
                iconBg="bg-[var(--success)]"
                href="/listings"
              />
            </>
          )}
        </div>
      </div>

      {/* Full Width - Recent Transactions */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('dashboard.recentTransactions')}</h2>
            <p className="text-[var(--text-muted)] text-sm">{t('dashboard.recentTransactionsSubtitle')}</p>
          </div>
          <a
            href="/orders"
            className="text-[var(--primary)] hover:underline text-sm font-medium"
          >
            {t('dashboard.viewAll')}
          </a>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[100px_1fr_120px_100px_100px_120px] gap-4 pb-3 border-b border-[var(--border-color)] text-sm font-medium text-[var(--text-muted)]">
          <div>{t('dashboard.table.orderId')}</div>
          <div>{t('dashboard.table.customer')}</div>
          <div>{t('dashboard.table.date')}</div>
          <div>{t('dashboard.table.amount')}</div>
          <div>{t('dashboard.table.status')}</div>
          <div>{t('dashboard.table.actions')}</div>
        </div>

        {/* Transaction Rows */}
        <div>
          {loadingTransactions ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">{t('dashboard.noOrders')}</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">{t('dashboard.noOrdersHint')}</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <TransactionRow
                key={transaction.order_id}
                orderId={transaction.order_id}
                customer={transaction.customer}
                date={transaction.date}
                amount={transaction.amount}
                status={transaction.payment_status as 'paid' | 'unpaid'}
                onMessage={() => handleMessageCustomer(transaction.customer)}
                statusLabels={{
                  paid: t('dashboard.status.paid'),
                  unpaid: t('dashboard.status.unpaid'),
                }}
                messageLabel={t('dashboard.message')}
              />
            ))
          )}
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
