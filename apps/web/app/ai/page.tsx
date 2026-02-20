'use client';

/**
 * AI Generation Page - Full Integration
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Sparkles,
  Zap,
  AlertCircle,
  Play,
  CheckCircle,
  FileText,
  Wand2,
  Tag,
} from 'lucide-react';
import { aiApi, productsApi, AIStats, AIGeneration, Product } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useLanguage } from '@/lib/language-context';
import { parseAIError, AIErrorDetails } from '@/lib/ai-error-handler';
import { AIErrorModal } from '@/components/modals/AIErrorModal';
import { Alert } from '@/components/ui/Alert';

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
  const { t } = useLanguage();
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
            {t('ai.completed')}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[var(--danger)] text-sm">
            <AlertCircle className="w-4 h-4" />
            {t('ai.failed')}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AIGenerationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentGenerations, setRecentGenerations] = useState<AIGeneration[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [errorDetails, setErrorDetails] = useState<AIErrorDetails | null>(null);

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
      showToast(t('ai.loadProductsFailed'), 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadRecentGenerations();
    loadProducts();
  }, []);

  // Shared generate handler — accepts a generate_type
  const handleGenerate = async (generateType: string = 'all') => {
    if (!selectedProductId) {
      showToast(t('ai.selectProductFirst'), 'error');
      return;
    }

    const labels: Record<string, string> = {
      all: t('ai.allContent'),
      title: t('ai.titleOnly'),
      description: t('ai.descriptionOnly'),
      tags: t('ai.tagsOnly'),
    };

    try {
      setGenerating(true);
      const result = await aiApi.generateContent(selectedProductId, { generate_type: generateType });

      showToast(
        `${labels[generateType]} ${t('ai.generatedSuccess')} $${(result.cost.usd_cents / 100).toFixed(2)}`,
        'success'
      );

      // Reload stats and recent generations
      await Promise.all([loadStats(), loadRecentGenerations()]);

      if (generateType === 'all') {
        setSelectedProductId(null);
      }
    } catch (error: any) {
      console.error('AI generation failed:', error);
      const errorInfo = parseAIError(error);
      setErrorDetails(errorInfo);
      showToast(errorInfo.title, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-[var(--primary)]" />
            {t('ai.title')}
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            {t('ai.subtitle')}
          </p>
        </div>

        {/* Info Banner */}
        {!selectedProductId && (
          <Alert>
            {t('ai.selectProductBanner')}
          </Alert>
        )}

        {/* Stats and Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Generations Stat */}
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
                <p className="text-[var(--text-muted)] text-sm">{t('ai.totalGenerations')}</p>
              </div>
            </div>
          </div>

          {/* Quick Action: Title Only */}
          <button
            onClick={() => handleGenerate('title')}
            disabled={generating || !selectedProductId}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--primary)] hover:bg-[var(--card-bg-hover)] transition-all cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--info-bg)] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{t('ai.titleOnly')}</p>
                <p className="text-[var(--text-muted)] text-sm">
                  {generating ? t('ai.generating') : t('ai.generateSeoTitle')}
                </p>
              </div>
            </div>
          </button>

          {/* Quick Action: Description Only */}
          <button
            onClick={() => handleGenerate('description')}
            disabled={generating || !selectedProductId}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--primary)] hover:bg-[var(--card-bg-hover)] transition-all cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--success-bg)] flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-[var(--success)]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{t('ai.descriptionOnly')}</p>
                <p className="text-[var(--text-muted)] text-sm">
                  {generating ? t('ai.generating') : t('ai.generateDescription')}
                </p>
              </div>
            </div>
          </button>

          {/* Quick Action: Tags Only */}
          <button
            onClick={() => handleGenerate('tags')}
            disabled={generating || !selectedProductId}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--primary)] hover:bg-[var(--card-bg-hover)] transition-all cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--warning-bg)] flex items-center justify-center">
                <Tag className="w-5 h-5 text-[var(--warning)]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{t('ai.tagsOnly')}</p>
                <p className="text-[var(--text-muted)] text-sm">
                  {generating ? t('ai.generating') : t('ai.generateTags')}
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content Generation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Generate */}
            <DashboardCard title={t('ai.quickGenerate')} subtitle={t('ai.quickGenerateSubtitle')}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    {t('ai.selectProduct')}
                  </label>
                  {loadingProducts ? (
                    <div className="w-full h-12 bg-[var(--background)] animate-pulse rounded-lg" />
                  ) : (
                    <select
                      value={selectedProductId || ''}
                      onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                    >
                      <option value="">{t('ai.selectProductPlaceholder')}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title_raw || `Product #${product.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {products.length === 0 && !loadingProducts && (
                    <p className="text-[var(--text-muted)] text-sm mt-2">
                      {t('ai.noProducts')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    {t('ai.generateAllContent')}
                  </label>
                  <p className="text-[var(--text-muted)] text-xs mb-3">
                    {t('ai.generateAllDescription')}
                  </p>
                </div>
                <button
                  onClick={() => handleGenerate('all')}
                  disabled={!selectedProductId || generating || loadingProducts}
                  className="w-full py-3 gradient-primary text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('ai.generating')}
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      {t('ai.generateAll')}
                    </>
                  )}
                </button>
              </div>
            </DashboardCard>
          </div>

          {/* Recent Generations */}
          <div className="space-y-6">
            <DashboardCard
              title={t('ai.recentGenerations')}
              subtitle={t('ai.recentGenerationsSubtitle')}
              action={
                <button
                  onClick={() => router.push('/ai/history')}
                  className="text-sm text-[var(--primary)] hover:underline"
                >
                  {t('ai.viewAll')}
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
                  <p className="text-[var(--text-muted)]">{t('ai.noGenerations')}</p>
                  <p className="text-[var(--text-muted)] text-sm mt-1">
                    {t('ai.startGenerating')}
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
                  <h4 className="text-[var(--text-primary)] font-semibold mb-2">{t('ai.proTips')}</h4>
                  <ul className="text-[var(--text-muted)] text-sm space-y-1">
                    <li>• {t('ai.tip1')}</li>
                    <li>• {t('ai.tip2')}</li>
                    <li>• {t('ai.tip3')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Error Modal */}
      {errorDetails && (
        <AIErrorModal
          error={errorDetails}
          onClose={() => setErrorDetails(null)}
        />
      )}
    </DashboardLayout>
  );
}
