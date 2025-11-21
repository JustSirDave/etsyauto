'use client';

/**
 * Products Management Page
 * View, import, and manage products before listing
 */

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Upload, Plus, Trash2, RefreshCw, Download, Filter } from 'lucide-react';

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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [filterBatch, setFilterBatch] = useState<string | undefined>();

  const limit = 20;

  useEffect(() => {
    loadProducts();
  }, [page, filterBatch]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productsApi.getAll(page, limit, filterBatch);
      setProducts(response.products);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleSelectProduct = (id: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedProducts.size} products?`)) return;

    try {
      await Promise.all(
        Array.from(selectedProducts).map(id => productsApi.delete(id))
      );
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete some products');
    }
  };

  const handleFileImport = async (file: File) => {
    try {
      if (file.name.endsWith('.csv')) {
        await productsApi.importCsv(file);
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          await productsApi.importBatch(data);
        } else {
          await productsApi.importSingle(data);
        }
      } else {
        alert('Only CSV and JSON files are supported');
        return;
      }

      setShowImportModal(false);
      loadProducts();
    } catch (error: any) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error.detail || error.message}`);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Products</h1>
          <p className="text-slate-400 mt-1">
            Manage your product catalog before listing to Etsy
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import Products
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Total Products</div>
          <div className="text-2xl font-bold text-white mt-1">{total}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Ready to List</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {products.filter(p => p.status === 'ready').length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Pending AI</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {products.filter(p => p.status === 'pending').length}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm">Selected</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">
            {selectedProducts.size}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedProducts.size > 0 && (
        <div className="bg-teal-900/20 border border-teal-700 rounded-lg p-4 flex items-center justify-between">
          <span className="text-white">
            {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="p-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === products.length && products.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-600 bg-slate-700 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="p-4 text-left text-slate-300 font-medium">SKU</th>
                <th className="p-4 text-left text-slate-300 font-medium">Title</th>
                <th className="p-4 text-left text-slate-300 font-medium">Price</th>
                <th className="p-4 text-left text-slate-300 font-medium">Quantity</th>
                <th className="p-4 text-left text-slate-300 font-medium">Status</th>
                <th className="p-4 text-left text-slate-300 font-medium">Batch</th>
                <th className="p-4 text-left text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No products found. Import your first products to get started.
                  </td>
                </tr>
              ) : (
                products.map(product => (
                  <tr key={product.id} className="hover:bg-slate-750 transition-colors">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="rounded border-slate-600 bg-slate-700 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="p-4 text-white font-mono text-sm">{product.sku}</td>
                    <td className="p-4 text-white max-w-xs truncate">{product.title}</td>
                    <td className="p-4 text-white">${product.price ? product.price.toFixed(2) : '0.00'}</td>
                    <td className="p-4 text-white">{product.quantity || 0}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'ready'
                            ? 'bg-green-900/30 text-green-400'
                            : product.status === 'pending'
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm font-mono">
                      {product.batch_id ? product.batch_id.slice(0, 8) : '-'}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={async () => {
                          if (confirm('Delete this product?')) {
                            await productsApi.delete(product.id);
                            loadProducts();
                          }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-700 p-4 flex items-center justify-between">
            <div className="text-slate-400 text-sm">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} products
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Import Products</h2>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-300 mb-2">Drop files here or click to browse</p>
                <p className="text-slate-500 text-sm mb-4">Supports CSV and JSON formats</p>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileImport(file);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer transition-colors"
                >
                  Choose File
                </label>
              </div>

              <div className="bg-slate-900 rounded-lg p-4 text-sm">
                <h3 className="text-white font-medium mb-2">CSV Format Requirements:</h3>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>Headers: sku, title, description, price, quantity</li>
                  <li>SKU must be unique</li>
                  <li>Price should be numeric (e.g., 29.99)</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
