'use client';

/**
 * AI Generation Page - Full Integration
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Sparkles,
  Wand2,
  FileText,
  Image,
  Tag,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Play,
  Settings,
} from 'lucide-react';
import { aiApi, productsApi, AIStats, AIGeneration, Product } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

// AI Tool Card Component
function AIToolCard({
  title,
  description,
  icon: Icon,
  iconBg,
  status,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  status?: 'available' | 'coming_soon';
  onClick?: () => void;
}) {
  const isAvailable = status !== 'coming_soon';

  return (
    <button
      onClick={isAvailable ? onClick : undefined}
      disabled={!isAvailable}
      className={`w-full text-left p-5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl transition-all duration-200 ${
        isAvailable
          ? 'hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/10 cursor-pointer'
          : 'opacity-60 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[var(--text-primary)] font-semibold">{title}</h3>
            {status === 'coming_soon' && (
              <span className="px-2 py-0.5 bg-[var(--warning-bg)] text-[var(--warning)] text-xs font-medium rounded-full">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-[var(--text-muted)] text-sm">{description}</p>
        </div>
        {isAvailable && (
          <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
        )}
      </div>
    </button>
  );
}

// Recent Generation Item
function RecentGeneration({
  type,
  title,
  timestamp,
  status,
}: {
  type: 'title' | 'description' | 'tags';
  title: string;
  timestamp: string;
  status: 'completed' | 'failed';
}) {
  const typeIcons = {
    title: FileText,
    description: Wand2,
    tags: Tag,
  };
  const Icon = typeIcons[type];

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-[var(--text-primary)] font-medium">{title}</p>
          <p className="text-[var(--text-muted)] text-sm">{timestamp}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === 'completed' ? (
          <span className="flex items-center gap-1 text-[var(--success)] text-sm">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[var(--danger)] text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed
          </span>
        )}
      </div>
    </div>
  );
}

export default function AIGenerationPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentGenerations, setRecentGenerations] = useState<AIGeneration[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  // Load stats
  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const data = await aiApi.getStats();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load AI stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load recent generations
  const loadRecentGenerations = async () => {
    try {
      setLoadingGenerations(true);
      const data = await aiApi.getRecentGenerations(4);
      setRecentGenerations(data.generations);
    } catch (error: any) {
      console.error('Failed to load recent generations:', error);
    } finally {
      setLoadingGenerations(false);
    }
  };

  // Load products for dropdown
  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const data = await productsApi.getAll(1, 100);
      setProducts(data.products);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      showToast('Failed to load products', 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadRecentGenerations();
    loadProducts();
  }, []);

  // Handle AI generation
  const handleGenerate = async () => {
    if (!selectedProductId) {
      showToast('Please select a product first', 'error');
      return;
    }

    try {
      setGenerating(true);
      const result = await aiApi.generateContent(selectedProductId);

      showToast(
        `AI content generated successfully! Cost: $${(result.cost.usd_cents / 100).toFixed(2)}`,
        'success'
      );

      // Reload stats and recent generations
      await Promise.all([loadStats(), loadRecentGenerations()]);

      // Reset selection
      setSelectedProductId(null);
    } catch (error: any) {
      console.error('AI generation failed:', error);
      showToast(error.detail || 'Failed to generate AI content', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-[var(--primary)]" />
              AI Generation
            </h1>
            <p className="text-[var(--text-muted)] mt-1">
              Generate product titles, descriptions, and tags using AI
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg-hover)] transition-colors"
            onClick={() => showToast('AI Settings coming soon', 'info')}
          >
            <Settings className="w-4 h-4" />
            AI Settings
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                {loadingStats ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats?.total_generations.toLocaleString() || 0}</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Total Generations</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--success-bg)] flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
              </div>
              <div>
                {loadingStats ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stats?.success_rate.toFixed(1) || 0}%</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Success Rate</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--info-bg)] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                {loadingStats ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{((stats?.avg_response_time_ms || 0) / 1000).toFixed(1)}s</p>
                )}
                <p className="text-[var(--text-muted)] text-sm">Avg. Response Time</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--warning-bg)] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[var(--warning)]" />
              </div>
              <div>
                {loadingStats ? (
                  <div className="w-16 h-8 bg-[var(--background)] animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats?.growth_percentage ? (stats.growth_percentage > 0 ? '+' : '') + stats.growth_percentage.toFixed(0) : 0}%
                  </p>
                )}
                <p className="text-[var(--text-muted)] text-sm">This Month</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Tools */}
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard title="AI Tools" subtitle="Select a tool to get started">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIToolCard
                  title="Title Generator"
                  description="Generate SEO-optimized product titles"
                  icon={FileText}
                  iconBg="gradient-primary"
                  status="available"
                  onClick={() => showToast('Generate content using the form below', 'info')}
                />
                <AIToolCard
                  title="Description Writer"
                  description="Create compelling product descriptions"
                  icon={Wand2}
                  iconBg="gradient-info"
                  status="available"
                  onClick={() => showToast('Generate content using the form below', 'info')}
                />
                <AIToolCard
                  title="Tag Optimizer"
                  description="Generate relevant tags for better visibility"
                  icon={Tag}
                  iconBg="gradient-success"
                  status="available"
                  onClick={() => showToast('Generate content using the form below', 'info')}
                />
                <AIToolCard
                  title="Image Enhancer"
                  description="AI-powered image optimization"
                  icon={Image}
                  iconBg="gradient-warning"
                  status="coming_soon"
                />
              </div>
            </DashboardCard>

            {/* Quick Generate */}
            <DashboardCard title="Quick Generate" subtitle="Generate content for a product">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Select Product
                  </label>
                  {loadingProducts ? (
                    <div className="w-full h-12 bg-[var(--background)] animate-pulse rounded-lg" />
                  ) : (
                    <select
                      value={selectedProductId || ''}
                      onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                    >
                      <option value="">Select a product...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title_raw || `Product #${product.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {products.length === 0 && !loadingProducts && (
                    <p className="text-[var(--text-muted)] text-sm mt-2">
                      No products found. Add products first to generate AI content.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    What to Generate
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-4 py-2 bg-[var(--primary-bg)] border border-[var(--primary)] rounded-lg text-[var(--primary)] text-sm font-medium">
                      All (Title + Description + Tags)
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] text-xs mt-2">
                    Currently generates all content types together for best results
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedProductId || generating || loadingProducts}
                  className="w-full py-3 gradient-primary text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Generate Now
                    </>
                  )}
                </button>
              </div>
            </DashboardCard>
          </div>

          {/* Recent Generations */}
          <div className="space-y-6">
            <DashboardCard
              title="Recent Generations"
              subtitle="Your latest AI generations"
              action={
                <button
                  onClick={() => showToast('Generation history coming soon', 'info')}
                  className="text-sm text-[var(--primary)] hover:underline"
                >
                  View All
                </button>
              }
            >
              {loadingGenerations ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <div className="w-10 h-10 bg-[var(--background)] animate-pulse rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="w-3/4 h-4 bg-[var(--background)] animate-pulse rounded" />
                        <div className="w-1/2 h-3 bg-[var(--background)] animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentGenerations.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--text-muted)]">No generations yet</p>
                  <p className="text-[var(--text-muted)] text-sm mt-1">
                    Start generating AI content for your products
                  </p>
                </div>
              ) : (
                recentGenerations.map((gen) => (
                  <RecentGeneration
                    key={gen.id}
                    type={gen.type}
                    title={gen.title}
                    timestamp={gen.timestamp}
                    status={gen.status}
                  />
                ))
              )}
            </DashboardCard>

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-[var(--primary-bg)] to-[var(--info-bg)] border border-[var(--primary)]/30 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-[var(--text-primary)] font-semibold mb-2">Pro Tips</h4>
                  <ul className="text-[var(--text-muted)] text-sm space-y-1">
                    <li>• Be specific with your product details</li>
                    <li>• Include target keywords for better SEO</li>
                    <li>• Review and customize generated content</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
