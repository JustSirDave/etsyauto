'use client';

/**
 * AI Generation Management Page
 * Preview, approve, and regenerate AI-generated content
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { Sparkles, Check, X, RefreshCw, AlertTriangle, Eye, Plus, Trash2 } from 'lucide-react';
import { getAIQueue, removeFromAIQueue, type QueuedProduct } from '@/lib/ai-queue';
import { useToast } from '@/lib/toast-context';

interface Product {
  id: number;
  sku: string;
  title: string;
  description: string | null;
  price: number;
  quantity: number;
  images: string[];
  status: string;
  batch_id: string | null;
  created_at: string;
}

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

export default function AIGenerationPage() {
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

    // Listen for queue updates from other pages
    const handleQueueUpdate = () => loadQueue();
    window.addEventListener('ai-queue-updated', handleQueueUpdate);

    return () => {
      window.removeEventListener('ai-queue-updated', handleQueueUpdate);
    };
  }, []);

  const loadQueue = () => {
    setQueuedProducts(getAIQueue());
  };

  const handleGenerateAI = async (productId: number) => {
    console.log('Starting AI generation for product:', productId);
    try {
      setGenerating(true);
      setGeneratingProductId(productId);
      setSelectedProductId(productId);
      
      console.log('Calling productsApi.generateAI...');
      const result = await productsApi.generateAI(productId);
      console.log('AI generation successful:', result);
      
      setGeneration(result);
      
      console.log('Showing success toast...');
      showToast('AI content generated successfully!', 'success');
      setStatusMessage({ type: 'success', text: 'AI content generated successfully!' });
      console.log('Success toast called');
      
      // Clear status message after 5 seconds
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (error: any) {
      console.error('AI generation failed:', error);
      console.error('Error detail:', error?.detail);
      console.error('Error message:', error?.message);
      
      // Extract user-friendly error message
      let errorMessage = 'An error occurred while generating content';
      
      if (error?.detail) {
        // If detail is a string, use it
        if (typeof error.detail === 'string') {
          errorMessage = error.detail;
        } 
        // If detail is an object with a message property
        else if (error.detail?.message) {
          errorMessage = error.detail.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Check for specific error types and provide user-friendly messages
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. Please check your API key and billing.';
      } else if (errorMessage.includes('API key') || errorMessage.includes('401')) {
        errorMessage = 'Invalid OpenAI API key. Please check your settings.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (errorMessage.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      console.log('Showing error toast with message:', errorMessage);
      showToast(`AI generation failed: ${errorMessage}`, 'error', 8000);
      setStatusMessage({ type: 'error', text: errorMessage });
      console.log('Error toast called');
      
      // Clear status message after 8 seconds
      setTimeout(() => setStatusMessage(null), 8000);
    } finally {
      setGenerating(false);
      setGeneratingProductId(null);
      console.log('AI generation process completed');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Content Generation</h1>
          <p className="text-slate-400 mt-1">
            Generate policy-compliant, SEO-optimized Etsy listings with AI
          </p>
        </div>
      </div>

      {/* Status Message Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-lg border ${
          statusMessage.type === 'success' 
            ? 'bg-green-900/20 border-green-500 text-green-100' 
            : 'bg-red-900/20 border-red-500 text-red-100'
        } flex items-start gap-3`}>
          {statusMessage.type === 'success' ? (
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <div className="flex-1">
            <p className="font-medium">{statusMessage.text}</p>
            {statusMessage.type === 'error' && statusMessage.text.includes('quota') && (
              <p className="text-sm mt-1 opacity-90">
                Please verify your OpenAI API key has sufficient credits and billing is set up correctly.
              </p>
            )}
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Queued Products */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Generation Queue</h2>
          <button
            onClick={() => router.push('/products')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Products
          </button>
        </div>

        {queuedProducts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
            <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No products in queue</p>
            <p className="text-slate-500 text-sm mb-4">
              Select products from the Products page to generate AI content
            </p>
            <button
              onClick={() => router.push('/products')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Go to Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queuedProducts.map(product => (
              <div
                key={product.id}
                className={`bg-slate-900 rounded-lg p-4 border-2 transition-all ${
                  selectedProductId === product.id
                    ? 'border-teal-500 shadow-lg shadow-teal-500/20'
                    : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{product.title}</h3>
                    <p className="text-slate-400 text-sm font-mono mt-1">{product.sku}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveFromQueue(product.id)}
                    className="text-slate-400 hover:text-red-400 transition-colors ml-2"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleGenerateAI(product.id)}
                  disabled={generating && generatingProductId === product.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {generating && generatingProductId === product.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Content
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">In Queue</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {queuedProducts.length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Ready to Review</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">0</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Approved</div>
          <div className="text-2xl font-bold text-green-400 mt-1">0</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Total Cost</div>
          <div className="text-2xl font-bold text-white mt-1">$0.00</div>
        </div>
      </div>

      {/* AI Generation Preview */}
      {selectedProductId && generation && (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Generated Content Preview</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Product ID: {selectedProductId}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[600px]">
            <div className="space-y-6">
              {/* Policy Violations Warning */}
              {generation.policy_violations && generation.policy_violations.length > 0 && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-red-400 font-medium mb-2">Policy Violations Detected</h3>
                      <ul className="text-red-300 text-sm space-y-1">
                        {generation.policy_violations.map((violation: any, i: number) => (
                          <li key={i}>• {violation.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Title */}
              <div>
                <label className="text-slate-400 text-sm font-medium block mb-2">
                  Listing Title
                </label>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-white">{generation.title}</p>
                  <p className="text-slate-500 text-xs mt-2">
                    {generation.title.length} / 140 characters
                  </p>
                </div>
              </div>

              {/* Generated Description */}
              <div>
                <label className="text-slate-400 text-sm font-medium block mb-2">
                  Description
                </label>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-white whitespace-pre-wrap">{generation.description}</p>
                </div>
              </div>

              {/* Generated Tags */}
              <div>
                <label className="text-slate-400 text-sm font-medium block mb-2">
                  Tags
                </label>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {generation.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-teal-900/30 text-teal-400 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    {generation.tags.length} / 13 tags
                  </p>
                </div>
              </div>

              {/* SEO Title */}
              <div>
                <label className="text-slate-400 text-sm font-medium block mb-2">
                  SEO Title
                </label>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-white">{generation.seo_title}</p>
                </div>
              </div>

              {/* Generation Info */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                <div>
                  <div className="text-slate-500 text-xs">AI Provider</div>
                  <div className="text-white font-medium mt-1">{generation.provider}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Cost</div>
                  <div className="text-white font-medium mt-1">${generation.cost.toFixed(4)}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                  <Check className="w-5 h-5" />
                  Approve & Ready to List
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
