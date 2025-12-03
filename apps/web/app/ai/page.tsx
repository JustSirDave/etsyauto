'use client';

/**
 * AI Generation Page - Vuexy Style
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Sparkles, Check, X, RefreshCw, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { getAIQueue, removeFromAIQueue, type QueuedProduct } from '@/lib/ai-queue';
import { useToast } from '@/lib/toast-context';

interface AIGeneration {
  id: number;
  product_id: number;
  provider: string;
  title: string;
  description: string;
  tags: string[];
  seo_title: string;
  status: string;
  policy_violations: any[];
  cost: number;
  generated_at: string;
}

function AIContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [queuedProducts, setQueuedProducts] = useState<QueuedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [generation, setGeneration] = useState<AIGeneration | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingProductId, setGeneratingProductId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadQueue();
    const handleQueueUpdate = () => loadQueue();
    window.addEventListener('ai-queue-updated', handleQueueUpdate);
    return () => window.removeEventListener('ai-queue-updated', handleQueueUpdate);
  }, []);

  const loadQueue = () => setQueuedProducts(getAIQueue());

  const handleGenerateAI = async (productId: number) => {
    try {
      setGenerating(true);
      setGeneratingProductId(productId);
      setSelectedProductId(productId);
      const result = await productsApi.generateAI(productId);
      setGeneration(result);
      showToast('AI content generated successfully!', 'success');
      setStatusMessage({ type: 'success', text: 'AI content generated successfully!' });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (error: any) {
      let errorMessage = 'An error occurred while generating content';
      if (error?.detail) {
        errorMessage = typeof error.detail === 'string' ? error.detail : error.detail?.message || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. Please check your API key and billing.';
      } else if (errorMessage.includes('API key') || errorMessage.includes('401')) {
        errorMessage = 'Invalid OpenAI API key. Please check your settings.';
      }
      showToast(`AI generation failed: ${errorMessage}`, 'error', 8000);
      setStatusMessage({ type: 'error', text: errorMessage });
      setTimeout(() => setStatusMessage(null), 8000);
    } finally {
      setGenerating(false);
      setGeneratingProductId(null);
    }
  };

  const handleRemoveFromQueue = (productId: number) => {
    removeFromAIQueue(productId);
    if (selectedProductId === productId) {
      setSelectedProductId(null);
      setGeneration(null);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">AI Content Generation</h1>
          <p className="text-[var(--text-muted)]">Generate policy-compliant, SEO-optimized Etsy listings with AI</p>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${statusMessage.type === 'success' ? 'bg-[var(--success-bg)] border-[var(--success)]/30 text-[var(--success)]' : 'bg-[var(--danger-bg)] border-[var(--danger)]/30 text-[var(--danger)]'}`}>
          {statusMessage.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <X className="w-5 h-5 flex-shrink-0" />}
          <div className="flex-1">
            <p className="font-medium">{statusMessage.text}</p>
            {statusMessage.type === 'error' && statusMessage.text.includes('quota') && (
              <p className="text-sm mt-1 opacity-80">Please verify your OpenAI API key has sufficient credits.</p>
            )}
          </div>
          <button onClick={() => setStatusMessage(null)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">In Queue</p>
          <p className="text-3xl font-bold text-[var(--warning)] mt-1">{queuedProducts.length}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Ready to Review</p>
          <p className="text-3xl font-bold text-[var(--primary)] mt-1">0</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Approved</p>
          <p className="text-3xl font-bold text-[var(--success)] mt-1">0</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm">Total Cost</p>
          <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">$0.00</p>
        </div>
      </div>

      {/* Queue */}
      <DashboardCard
        title="Generation Queue"
        action={
          <button onClick={() => router.push('/products')} className="flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-lg text-sm font-medium shadow-lg">
            <Plus className="w-4 h-4" />Add Products
          </button>
        }
      >
        {queuedProducts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-[var(--border-color)] rounded-xl">
            <Sparkles className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] mb-2">No products in queue</p>
            <p className="text-[var(--text-muted)] text-sm mb-4">Select products from the Products page to generate AI content</p>
            <button onClick={() => router.push('/products')} className="inline-flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />Go to Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queuedProducts.map(product => (
              <div key={product.id} className={`bg-[var(--background)] rounded-xl p-4 border-2 transition-all ${selectedProductId === product.id ? 'border-[var(--primary)] shadow-lg shadow-[var(--primary)]/20' : 'border-[var(--border-color)]'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[var(--text-primary)] font-medium truncate">{product.title}</h3>
                    <p className="text-[var(--text-muted)] text-sm font-mono mt-1">{product.sku}</p>
                  </div>
                  <button onClick={() => handleRemoveFromQueue(product.id)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => handleGenerateAI(product.id)}
                  disabled={generating && generatingProductId === product.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {generating && generatingProductId === product.id ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />Generate Content</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {/* Preview */}
      {selectedProductId && generation && (
        <DashboardCard title="Generated Content Preview" subtitle={`Product ID: ${selectedProductId}`}>
          <div className="space-y-6">
            {/* Policy Violations */}
            {generation.policy_violations && generation.policy_violations.length > 0 && (
              <div className="bg-[var(--danger-bg)] border border-[var(--danger)]/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
                  <div>
                    <h3 className="text-[var(--danger)] font-medium mb-2">Policy Violations Detected</h3>
                    <ul className="text-[var(--danger)]/80 text-sm space-y-1">
                      {generation.policy_violations.map((v: any, i: number) => <li key={i}>• {v.message}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-[var(--text-muted)] text-sm font-medium block mb-2">Listing Title</label>
              <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border-color)]">
                <p className="text-[var(--text-primary)]">{generation.title}</p>
                <p className="text-[var(--text-muted)] text-xs mt-2">{generation.title.length} / 140 characters</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[var(--text-muted)] text-sm font-medium block mb-2">Description</label>
              <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border-color)]">
                <p className="text-[var(--text-primary)] whitespace-pre-wrap">{generation.description}</p>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[var(--text-muted)] text-sm font-medium block mb-2">Tags</label>
              <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border-color)]">
                <div className="flex flex-wrap gap-2">
                  {generation.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-[var(--primary-bg)] text-[var(--primary)] rounded-full text-sm">{tag}</span>
                  ))}
                </div>
                <p className="text-[var(--text-muted)] text-xs mt-2">{generation.tags.length} / 13 tags</p>
              </div>
            </div>

            {/* SEO Title */}
            <div>
              <label className="text-[var(--text-muted)] text-sm font-medium block mb-2">SEO Title</label>
              <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border-color)]">
                <p className="text-[var(--text-primary)]">{generation.seo_title}</p>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
              <div>
                <p className="text-[var(--text-muted)] text-xs">AI Provider</p>
                <p className="text-[var(--text-primary)] font-medium mt-1">{generation.provider}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs">Cost</p>
                <p className="text-[var(--text-primary)] font-medium mt-1">${generation.cost.toFixed(4)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--success)] hover:opacity-90 text-white rounded-xl transition-colors">
                <Check className="w-5 h-5" />Approve & Ready to List
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--danger)] hover:opacity-90 text-white rounded-xl transition-colors">
                <X className="w-5 h-5" />Reject
              </button>
            </div>
          </div>
        </DashboardCard>
      )}
    </div>
  );
}

export default function AIGenerationPage() {
  return <DashboardLayout><AIContent /></DashboardLayout>;
}
