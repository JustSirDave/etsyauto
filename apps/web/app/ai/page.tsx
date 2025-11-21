'use client';

/**
 * AI Generation Management Page
 * Preview, approve, and regenerate AI-generated content
 */

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Sparkles, Check, X, RefreshCw, AlertTriangle, Eye } from 'lucide-react';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [generation, setGeneration] = useState<AIGeneration | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadPendingProducts();
  }, []);

  const loadPendingProducts = async () => {
    try {
      setLoading(true);
      const response = await productsApi.getAll(1, 50);
      setProducts(response.products.filter((p: Product) => p.status === 'pending' || p.status === 'ready'));
    } catch (error: any) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async (productId: number) => {
    try {
      setGenerating(true);
      const result = await productsApi.generateAI(productId);
      setGeneration(result);
    } catch (error: any) {
      console.error('AI generation failed:', error);
      alert(`AI generation failed: ${error.detail || error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const selectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setGeneration(null);
    // In a real implementation, we'd load existing generation if available
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Pending Generation</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {products.filter(p => p.status === 'pending').length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Ready to Review</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">
            {products.filter(p => p.status === 'ready').length}
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product List */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Products</h2>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No products pending generation. Import products first.
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {products.map(product => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className={`w-full p-4 text-left hover:bg-slate-750 transition-colors ${
                      selectedProduct?.id === product.id ? 'bg-slate-750' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{product.title}</div>
                        <div className="text-sm text-slate-400 font-mono mt-1">{product.sku}</div>
                        <span
                          className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                            product.status === 'ready'
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                          }`}
                        >
                          {product.status}
                        </span>
                      </div>
                      <Sparkles className="w-5 h-5 text-teal-400 flex-shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Generation Preview */}
        <div className="lg:col-span-2 bg-slate-800 rounded-lg overflow-hidden">
          {!selectedProduct ? (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div>
                <Sparkles className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Select a product to generate AI content</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedProduct.title}</h2>
                    <p className="text-slate-400 text-sm mt-1">SKU: {selectedProduct.sku}</p>
                  </div>
                  <button
                    onClick={() => handleGenerateAI(selectedProduct.id)}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {generation ? 'Regenerate' : 'Generate AI Content'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[550px]">
                {!generation ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Eye className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400">
                      Click "Generate AI Content" to create optimized listing content
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
