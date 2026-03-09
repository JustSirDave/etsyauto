'use client';

/**
 * Products Page - Connected to Real API
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SearchInput, PageSizeDropdown, TableActions, Pagination, TableCheckbox } from '@/components/ui/DataTable';
import { Package, Upload, Plus, Download, X } from 'lucide-react';
import { productsApi, listingsApi, type Product } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useLanguage } from '@/lib/language-context';
import { useAuth } from '@/lib/auth-context';
import { useShop } from '@/lib/shop-context';
import { DisconnectedShopBanner } from '@/components/ui/DisconnectedShopBanner';
import { SyncStatusModal, useRecentSync } from '@/components/modals/SyncStatusModal';
import { ProductImportModal } from '@/components/products/ProductImportModal';
import { AddProductModal } from '@/components/products/AddProductModal';
import { EditProductModal } from '@/components/products/EditProductModal';

function ProductsContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { shops, selectedShopId, selectedShopIds } = useShop();
  const connectedShops = shops.filter((s) => s.status === 'connected');
  const isSupplier = user?.role?.toLowerCase() === 'supplier';
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
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const [syncTaskId, setSyncTaskId] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  // Queue of task IDs when multiple shops are selected (Bug 1).
  const [syncTaskQueue, setSyncTaskQueue] = useState<string[]>([]);
  const [publishModalProduct, setPublishModalProduct] = useState<Product | null>(null);
  const [publishModalShopIds, setPublishModalShopIds] = useState<number[]>([]);
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [publishValidationProduct, setPublishValidationProduct] = useState<Product | null>(null);
  const [publishValidationLoading, setPublishValidationLoading] = useState(false);
  const [publishValidationError, setPublishValidationError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { wasSyncedRecently } = useRecentSync('products');
  const searchParams = useSearchParams();

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
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    await loadProducts();
  };

  // Load products
  useEffect(() => {
    loadProducts().catch(() => {});
  }, [currentPage, pageSize, selectedShopIds]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    const productId = parseInt(editId);
    if (Number.isNaN(productId)) return;
    const found = products.find((p) => p.id === productId);
    if (found) {
      setEditingProduct(found);
    } else {
      productsApi
        .getById(productId)
        .then((p) => {
          setEditingProduct(p);
        })
        .catch(() => {});
    }
  }, [searchParams, products]);

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

  const handleSyncFromCatalog = async () => {
    const CATALOG_REFRESH_KEY = 'lastRefresh_catalog';
    const REFRESH_WINDOW_MS = 60 * 1000;
    const lastRefresh = typeof window !== 'undefined' ? localStorage.getItem(CATALOG_REFRESH_KEY) : null;
    const lastRefreshTime = lastRefresh ? parseInt(lastRefresh, 10) : 0;
    if (Date.now() - lastRefreshTime < REFRESH_WINDOW_MS) {
      showToast('Synchronization is up to date', 'success');
      return;
    }
    try {
      setRefreshingCatalog(true);
      await loadProducts();
      if (typeof window !== 'undefined') localStorage.setItem(CATALOG_REFRESH_KEY, Date.now().toString());
      showToast('Products refreshed', 'success');
    } catch (error: unknown) {
      showToast((error as { detail?: string })?.detail || t('toast.loadProductsFailed'), 'error');
    } finally {
      setRefreshingCatalog(false);
    }
  };

  // Closes the sync modal and resets all sync state (Bugs 1 + 2).
  const closeSyncModal = () => {
    setShowSyncModal(false);
    setSyncTaskId(null);
    setSyncTaskQueue([]);
    setSyncing(false);
  };

  // Called by SyncStatusModal when the current task completes.
  // Advances to the next queued task or, when the queue is empty, reloads products (Bugs 1 + 2).
  const handleSyncTaskComplete = () => {
    setSyncTaskQueue((prevQueue) => {
      if (prevQueue.length === 0) {
        // All tasks done — reload and close.
        loadProducts();
        setShowSyncModal(false);
        setSyncTaskId(null);
        setSyncing(false);
        return [];
      }
      // Advance to the next task ID; keep modal open.
      const [next, ...rest] = prevQueue;
      setSyncTaskId(next);
      return rest;
    });
  };

  const handleSyncFromEtsy = async () => {
    // Resolve the full list of shops to sync (Bug 1).
    const shopList =
      selectedShopIds.length > 0
        ? selectedShopIds
        : selectedShopId != null
        ? [selectedShopId]
        : [];

    if (shopList.length === 0) {
      showToast(t('toast.connectShopFirst'), 'error');
      return;
    }
    if (wasSyncedRecently) {
      const proceed = confirm('You synced products recently. Sync again?');
      if (!proceed) return;
    }

    setSyncing(true);
    try {
      // Kick off a sync task for every selected shop in parallel (Bug 1).
      const results = await Promise.allSettled(
        shopList.map((id) => productsApi.syncFromEtsy(id))
      );

      const taskIds: string[] = [];
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value?.task_id) {
          taskIds.push(res.value.task_id);
        } else if (res.status === 'rejected') {
          console.error('Failed to start sync for a shop:', res.reason);
        }
      }

      if (taskIds.length === 0) {
        // No background tasks started — show a brief toast and stop syncing.
        showToast(t('toast.syncQueued'), 'success');
        setSyncing(false);
        return;
      }

      // Open the modal for the first task; store the rest in the queue (Bug 1 + 2).
      // Leave syncing=true — it resets only when the modal is closed (Bug 2).
      const [first, ...rest] = taskIds;
      setSyncTaskId(first);
      setSyncTaskQueue(rest);
      setShowSyncModal(true);
    } catch (error: any) {
      console.error('Failed to sync from Etsy:', error);
      showToast(error.detail || t('toast.syncFailed'), 'error');
      setSyncing(false);
    }
    // NOTE: no finally block here — setSyncing(false) is deferred to closeSyncModal (Bug 2).
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

  const openPublishModal = (product: Product) => {
    const defaultIds =
      product.shop_id && connectedShops.some((s) => s.id === product.shop_id)
        ? [product.shop_id]
        : selectedShopIds.filter((id) => connectedShops.some((s) => s.id === id)).length > 0
        ? selectedShopIds.filter((id) => connectedShops.some((s) => s.id === id))
        : connectedShops.length > 0
        ? [connectedShops[0].id]
        : [];
    setPublishModalProduct(product);
    setPublishModalShopIds(defaultIds.length > 0 ? defaultIds : []);
  };

  // Load freshest product details when opening the publish modal so validation uses up-to-date data.
  useEffect(() => {
    if (!publishModalProduct) {
      setPublishValidationProduct(null);
      setPublishValidationError(null);
      setPublishValidationLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setPublishValidationLoading(true);
      setPublishValidationError(null);
      try {
        const full = await productsApi.getById(publishModalProduct.id);
        if (!cancelled) {
          setPublishValidationProduct(full);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to load product for publish validation', err);
          setPublishValidationError(err?.detail || 'Could not load latest product details.');
        }
      } finally {
        if (!cancelled) {
          setPublishValidationLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [publishModalProduct?.id]);

  const togglePublishModalShop = (shopId: number) => {
    setPublishModalShopIds((prev) =>
      prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
    );
  };

  const handlePublishToShops = async () => {
    if (!publishModalProduct || publishModalShopIds.length === 0) return;
    setPublishSubmitting(true);
    try {
      let queued = 0;
      let failed = 0;
      let sawUnauthorized = false;
      for (const shopId of publishModalShopIds) {
        try {
          await listingsApi.create({ product_id: publishModalProduct.id, shop_id: shopId });
          queued++;
        } catch (err: any) {
          failed++;
          if (err?.status === 401) sawUnauthorized = true;
          console.error('Failed to queue listing for shop', shopId, err);
        }
      }
      if (sawUnauthorized) {
        showToast('Session expired. Please log in again.', 'error');
      }
      if (queued > 0) {
        const statusHint = ' Check the Listings page for status.';
        showToast(
          failed > 0
            ? `Queued for ${queued} shop(s); ${failed} failed.${statusHint}`
            : t('toast.publishQueued') + statusHint,
          'success'
        );
      }
      if (failed > 0 && queued === 0 && !sawUnauthorized) {
        showToast(
          publishModalShopIds.length === 1 ? t('toast.publishFailed') : 'Publish failed for all selected shops.',
          'error'
        );
      }
      setPublishModalProduct(null);
      setPublishModalShopIds([]);
    } catch (error: any) {
      console.error('Failed to publish listing:', error);
      showToast(error.detail || t('toast.publishFailed'), 'error');
    } finally {
      setPublishSubmitting(false);
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

  // Pre-publish validation: derive field presence from the freshest data we have.
  const validationProduct = publishValidationProduct || publishModalProduct;
  const hasTitle = !!validationProduct?.title_raw?.trim();
  const hasDescription = !!validationProduct?.description_raw?.trim();
  const hasPrice = validationProduct?.price != null && validationProduct.price > 0;
  const hasWhoMade = !!validationProduct?.who_made;
  const hasWhenMade = !!validationProduct?.when_made;
  const hasTaxonomy = validationProduct?.taxonomy_id != null;
  const hasTags = Array.isArray(validationProduct?.tags_raw) && validationProduct.tags_raw.length > 0;
  const hasImages = Array.isArray(validationProduct?.images) && validationProduct.images.length > 0;
  const hasMaterials =
    Array.isArray(validationProduct?.materials) && (validationProduct.materials as string[]).length > 0;

  const hasRequiredMissing = !!validationProduct && (!hasTitle || !hasDescription || !hasPrice || !hasWhoMade || !hasWhenMade || !hasTaxonomy);

  return (
    <div className="w-full min-w-0 max-w-full mx-auto space-y-6 overflow-x-hidden">
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 flex-wrap">
            <div className="w-full sm:w-80">
              <SearchInput
                placeholder={t('products.searchPlaceholder')}
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <PageSizeDropdown value={pageSize} onChange={setPageSize} />
              {isSupplier ? (
                <button
                  onClick={handleSyncFromCatalog}
                  disabled={refreshingCatalog}
                  className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  title="Refresh products from catalog"
                >
                  <Upload className="w-4 h-4" />
                  {refreshingCatalog ? 'Refreshing...' : 'Sync from catalog'}
                </button>
              ) : (
                <button
                  onClick={handleSyncFromEtsy}
                  disabled={(!selectedShopId && selectedShopIds.length === 0) || syncing}
                  className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  title={t('products.syncEtsy')}
                >
                  <Upload className="w-4 h-4" />
                  {syncing ? t('products.syncing') : t('products.syncEtsy')}
                </button>
              )}
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t('products.importCsv')}
              </button>
              {!isSupplier && (
                <button
                  onClick={handleExportProblemProducts}
                  className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
                  title="Export products with validation issues"
                >
                  <Download className="w-4 h-4" />
                  Export Problems
                </button>
              )}
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
        <div className="w-full min-w-0 overflow-hidden">
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
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-4 px-5 w-12 shrink-0">
                      <TableCheckbox
                        checked={selectedProducts.length === filteredProducts.length}
                        indeterminate={
                          selectedProducts.length > 0 &&
                          selectedProducts.length < filteredProducts.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[28%] min-w-0">
                      {t('products.table.product')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[8%] min-w-0">
                      {t('products.table.source')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[8%] min-w-0">
                      {t('products.table.price')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[8%] min-w-0">
                      {t('products.table.cost')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[7%] min-w-0">
                      {t('products.table.images')}
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[20%] min-w-0">
                      {t('products.table.tags')}
                    </th>
                    <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider w-[15%] min-w-0 shrink-0">
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
                      <td className="py-4 px-5 min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 rounded-lg bg-[var(--background)] flex items-center justify-center overflow-hidden">
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
                          <div className="min-w-0 overflow-hidden">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {product.title_raw || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-[var(--text-muted)] truncate">
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
                      <td className="py-4 px-5 text-[var(--text-primary)] font-medium">
                        {(product.cost_usd_cents ?? 0) > 0 ? `$${((product.cost_usd_cents ?? 0) / 100).toFixed(2)}` : '-'}
                      </td>
                      <td className="py-4 px-5 text-[var(--text-primary)]">
                        {product.images?.length || 0}
                      </td>
                      <td className="py-4 px-5 min-w-0 overflow-hidden">
                        <div className="flex flex-wrap gap-1 min-w-0">
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
                      <td className="py-4 px-5 shrink-0">
                        <div className="flex items-center justify-end gap-2">
                          {!isSupplier && (
                            <button
                              onClick={() => openPublishModal(product)}
                              disabled={!!product.etsy_listing_id || connectedShops.length === 0}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--primary-bg)] hover:text-[var(--primary)] disabled:opacity-60 disabled:cursor-not-allowed transition"
                              title={product.etsy_listing_id ? t('products.alreadyOnEtsy') : t('products.publish')}
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                          <TableActions
                            onView={() => router.push(`/products/${product.id}`)}
                            onEdit={!isSupplier ? () => setEditingProduct(product) : undefined}
                            onDelete={!isSupplier ? () => handleDelete(product.id) : undefined}
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

      {editingProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <EditProductModal
            isOpen={!!editingProduct}
            onClose={() => setEditingProduct(null)}
            product={editingProduct}
            onSuccess={() => {
              setEditingProduct(null);
              fetchProducts();
            }}
            showToast={showToast}
          />
        </div>
      )}

      <SyncStatusModal
        isOpen={showSyncModal}
        onClose={closeSyncModal}
        taskId={syncTaskId}
        syncType="products"
        onComplete={handleSyncTaskComplete}
      />

      {/* Publish to Etsy — choose shop(s) */}
      {publishModalProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t('products.publish')} to Etsy
              </h3>
              <button
                type="button"
                onClick={() => { setPublishModalProduct(null); setPublishModalShopIds([]); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] truncate" title={publishModalProduct.title_raw}>
              {publishModalProduct.title_raw || 'Untitled product'}
            </p>
            {/* Pre-publish validation checklist */}
            <div className="border border-[var(--border-color)] rounded-lg p-3 bg-[var(--background)] space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-primary)]">Listing validation</p>
                {publishValidationLoading && (
                  <span className="text-xs text-[var(--text-muted)]">Checking…</span>
                )}
              </div>
              {publishValidationError && (
                <p className="text-xs text-[var(--danger)]">{publishValidationError}</p>
              )}
              {hasRequiredMissing && (
                <div className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] text-[var(--warning)] px-3 py-2 text-xs">
                  <span className="mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <p>This product has missing required fields. Publishing may fail.</p>
                    <button
                      type="button"
                      className="mt-1 text-[var(--primary)] underline underline-offset-2"
                      onClick={() => {
                        setPublishModalProduct(null);
                        setPublishModalShopIds([]);
                        if (validationProduct) setEditingProduct(validationProduct);
                      }}
                    >
                      Edit Product →
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Title</span>
                  <span className={hasTitle ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {hasTitle ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Description</span>
                  <span className={hasDescription ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {hasDescription ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Price</span>
                  <span className={hasPrice ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {hasPrice ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Who made it</span>
                  <span className={hasWhoMade ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {hasWhoMade ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">When made</span>
                  <span className={hasWhenMade ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {hasWhenMade ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Category</span>
                  <span className={hasTaxonomy ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                    {hasTaxonomy ? '✅ Present' : '❌ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Tags (recommended)</span>
                  <span className={hasTags ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                    {hasTags ? '✅ Present' : '⚠️ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Images (recommended)</span>
                  <span className={hasImages ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                    {hasImages ? '✅ Present' : '⚠️ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)]">Materials (recommended)</span>
                  <span className={hasMaterials ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                    {hasMaterials ? '✅ Present' : '⚠️ Missing'}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Select shop(s) to publish to:</p>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-[var(--border-color)] rounded-lg p-3">
              {connectedShops.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No connected shops.</p>
              ) : (
                connectedShops.map((shop) => (
                  <label
                    key={shop.id}
                    className="flex items-center gap-3 cursor-pointer rounded-lg p-2 hover:bg-[var(--background)]"
                  >
                    <input
                      type="checkbox"
                      checked={publishModalShopIds.includes(shop.id)}
                      onChange={() => togglePublishModalShop(shop.id)}
                      className="rounded border-[var(--border-color)]"
                    />
                    <span className="text-[var(--text-primary)]">{shop.display_name || `Shop ${shop.id}`}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPublishModalProduct(null); setPublishModalShopIds([]); }}
                className="px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--background)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handlePublishToShops}
                disabled={publishModalShopIds.length === 0 || publishSubmitting}
                className="px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {publishSubmitting
                  ? 'Publishing…'
                  : `Publish to ${publishModalShopIds.length} shop${publishModalShopIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return <DashboardLayout><ProductsContent /></DashboardLayout>;
}
