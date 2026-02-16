'use client';

/**
 * Products Page - Connected to Real API
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SearchInput, PageSizeDropdown, TableActions, Pagination, TableCheckbox } from '@/components/ui/DataTable';
import { Package, Upload, Plus, Download } from 'lucide-react';
import { productsApi, listingsApi, type Product } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useLanguage } from '@/lib/language-context';
import { useShop } from '@/lib/shop-context';
import { DisconnectedShopBanner } from '@/components/ui/DisconnectedShopBanner';
import { SyncStatusModal, useRecentSync } from '@/components/modals/SyncStatusModal';
import { ProductImportModal } from '@/components/products/ProductImportModal';
import { AddProductModal } from '@/components/products/AddProductModal';

function ProductsContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { shops, selectedShopId, selectedShopIds } = useShop();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncTaskId, setSyncTaskId] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const { wasSyncedRecently } = useRecentSync('products');

  // Load products
  useEffect(() => {
    loadProducts();
  }, [currentPage, pageSize, selectedShopIds]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await productsApi.getAll(
        currentPage,
        pageSize,
        undefined,
        { shopIds: selectedShopIds.length > 0 ? selectedShopIds : undefined }
      );
      setProducts(data.products);
      setTotal(data.total);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      showToast(error.detail || t('toast.loadProductsFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await productsApi.delete(productId);
      showToast(t('toast.productDeleted'), 'success');
      loadProducts();
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      showToast(error.detail || t('toast.deleteProductFailed'), 'error');
    }
  };

  const handleSyncFromEtsy = async () => {
    if (!selectedShopId) {
      showToast(t('toast.connectShopFirst'), 'error');
      return;
    }
    if (wasSyncedRecently) {
      const proceed = confirm('You synced products recently. Sync again?');
      if (!proceed) return;
    }
    try {
      setSyncing(true);
      const result = await productsApi.syncFromEtsy(selectedShopId);
      if (result?.task_id) {
        setSyncTaskId(result.task_id);
        setShowSyncModal(true);
      } else {
        showToast(t('toast.syncQueued'), 'success');
      }
    } catch (error: any) {
      console.error('Failed to sync from Etsy:', error);
      showToast(error.detail || t('toast.syncFailed'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportProblemProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/products/export/problem-products`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `problem_products_${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      showToast('Problem products exported successfully', 'success');
    } catch (error: any) {
      console.error('Failed to export:', error);
      showToast(error.detail || 'Failed to export problem products', 'error');
    }
  };

  const handlePublishToEtsy = async (product: Product) => {
    const targetShopId = product.shop_id ?? selectedShopId;
    if (!targetShopId) {
      showToast(t('toast.selectShop'), 'error');
      return;
    }
    try {
      await listingsApi.create({ product_id: product.id, shop_id: targetShopId });
      showToast(t('toast.publishQueued'), 'success');
    } catch (error: any) {
      console.error('Failed to publish listing:', error);
      showToast(error.detail || t('toast.publishFailed'), 'error');
    }
  };

  // Client-side search filter (shop filtering handled by backend)
  const filteredProducts = products.filter((product) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !product.title_raw.toLowerCase().includes(query) &&
        !product.description_raw?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const toggleSelectAll = () =>
    setSelectedProducts(
      selectedProducts.length === filteredProducts.length
        ? []
        : filteredProducts.map((p) => p.id)
    );

  const toggleSelect = (id: number) =>
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <DisconnectedShopBanner />

      {/* Header Stats */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('products.title')}</h2>
            <p className="text-[var(--text-muted)] mt-1">
              {t('products.subtitle')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[var(--text-primary)]">{total}</p>
            <p className="text-sm text-[var(--text-muted)]">{t('products.total')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <DashboardCard title={t('products.filter')} noPadding>
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="w-full sm:w-80">
              <SearchInput
                placeholder={t('products.searchPlaceholder')}
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <div className="flex items-center gap-3">
              <PageSizeDropdown value={pageSize} onChange={setPageSize} />
                <button
                onClick={handleSyncFromEtsy}
                disabled={!selectedShopId || syncing}
                className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  title={t('products.syncEtsy')}
              >
                <Upload className="w-4 h-4" />
                  {syncing ? t('products.syncing') : t('products.syncEtsy')}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t('products.importCsv')}
              </button>
              <button
                onClick={handleExportProblemProducts}
                className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
                title="Export products with validation issues"
              >
                <Download className="w-4 h-4" />
                Export Problems
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                {t('products.add')}
              </button>
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* Table */}
      <DashboardCard noPadding>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-muted)] text-lg">{t('products.noProducts')}</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                {searchQuery
                  ? t('products.trySearch')
                  : t('products.noProductsHint')}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('products.add')}
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-4 px-5 w-12">
                      <TableCheckbox
                        checked={selectedProducts.length === filteredProducts.length}
                        indeterminate={
                          selectedProducts.length > 0 &&
                          selectedProducts.length < filteredProducts.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t('products.table.product')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t('products.table.source')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t('products.table.price')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t('products.table.images')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t('products.table.tags')}
                    </th>
                    <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {t('products.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors"
                    >
                      <td className="py-4 px-5">
                        <TableCheckbox
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                        />
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center overflow-hidden">
                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.title_raw}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-[var(--text-muted)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {product.title_raw || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-[var(--text-muted)] truncate max-w-md">
                              {product.description_raw || 'No description'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--background)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                          {product.source || 'manual'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[var(--text-primary)] font-medium">
                        {product.price ? `$${(product.price / 100).toFixed(2)}` : '-'}
                      </td>
                      <td className="py-4 px-5 text-[var(--text-primary)]">
                        {product.images?.length || 0}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {product.tags_raw && product.tags_raw.length > 0 ? (
                            product.tags_raw.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--primary-bg)] text-[var(--primary)]"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-[var(--text-muted)]">{t('products.tags.none')}</span>
                          )}
                          {product.tags_raw && product.tags_raw.length > 3 && (
                            <span className="text-xs text-[var(--text-muted)]">
                              +{product.tags_raw.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePublishToEtsy(product)}
                            disabled={!!product.etsy_listing_id || (!selectedShopId && !product.shop_id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] disabled:opacity-60 disabled:cursor-not-allowed transition"
                            title={product.etsy_listing_id ? t('products.alreadyOnEtsy') : t('products.publish')}
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <TableActions
                            onView={() => router.push(`/products/${product.id}`)}
                            onEdit={() => router.push(`/products/${product.id}/edit`)}
                            onDelete={() => handleDelete(product.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </DashboardCard>

      {/* Import Modal */}
      <ProductImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          loadProducts();
          setCurrentPage(1);
        }}
      />

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProductAdded={() => {
          loadProducts();
          setCurrentPage(1);
        }}
      />

      <SyncStatusModal
        isOpen={showSyncModal}
        onClose={() => { setShowSyncModal(false); setSyncTaskId(null); }}
        taskId={syncTaskId}
        syncType="products"
        onComplete={loadProducts}
      />
    </div>
  );
}

export default function ProductsPage() {
  return <DashboardLayout><ProductsContent /></DashboardLayout>;
}
