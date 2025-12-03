'use client';

/**
 * Products Page - Vuexy Style
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { FilterDropdown, SearchInput, PageSizeDropdown, ExportButton, AddButton, TableActions, StatusBadge, StockIndicator, Pagination, TableCheckbox, CategoryBadge } from '@/components/ui/DataTable';
import { Store, Globe, Tag, Users, Package, ShoppingBag } from 'lucide-react';

const mockProducts = [
  { id: 1, name: 'Handmade Silver Ring', description: 'Beautiful handcrafted silver ring', category: 'Jewelry', categoryIcon: <Tag className="w-4 h-4" />, inStock: true, sku: '31063', price: 45.99, qty: 942, status: 'active' as const },
  { id: 2, name: 'Vintage Leather Wallet', description: 'Premium vintage leather wallet', category: 'Accessories', categoryIcon: <ShoppingBag className="w-4 h-4" />, inStock: true, sku: '5829', price: 89.00, qty: 587, status: 'active' as const },
  { id: 3, name: 'Custom Photo Frame', description: 'Personalized wooden photo frame', category: 'Home Decor', categoryIcon: <Store className="w-4 h-4" />, inStock: false, sku: '9485', price: 34.50, qty: 0, status: 'inactive' as const },
  { id: 4, name: 'Ceramic Plant Pot', description: 'Hand-painted ceramic pot', category: 'Home Decor', categoryIcon: <Store className="w-4 h-4" />, inStock: true, sku: '2345', price: 28.00, qty: 234, status: 'active' as const },
  { id: 5, name: 'Wooden Jewelry Box', description: 'Elegant wooden box', category: 'Accessories', categoryIcon: <ShoppingBag className="w-4 h-4" />, inStock: true, sku: '8959', price: 65.00, qty: 156, status: 'active' as const },
  { id: 6, name: 'Knitted Scarf', description: 'Hand-knitted winter scarf', category: 'Clothing', categoryIcon: <Package className="w-4 h-4" />, inStock: true, sku: '7892', price: 42.00, qty: 89, status: 'draft' as const },
  { id: 7, name: 'Beaded Bracelet Set', description: 'Set of 3 bracelets', category: 'Jewelry', categoryIcon: <Tag className="w-4 h-4" />, inStock: true, sku: '4521', price: 24.99, qty: 445, status: 'active' as const },
];

const statsData = [
  { title: 'In-store Sales', value: '$5,345', subtitle: '5k orders', change: '+5.7%', icon: <Store className="w-6 h-6" /> },
  { title: 'Website Sales', value: '$674,347', subtitle: '21k orders', change: '+12.4%', icon: <Globe className="w-6 h-6" /> },
  { title: 'Discount', value: '$14,235', subtitle: '6k orders', change: null, icon: <Tag className="w-6 h-6" /> },
  { title: 'Affiliate', value: '$8,345', subtitle: '150 orders', change: '-3.5%', icon: <Users className="w-6 h-6" /> },
];

function ProductsContent() {
  const router = useRouter();
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [pageSize, setPageSize] = useState(7);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSelectAll = () => setSelectedProducts(selectedProducts.length === mockProducts.length ? [] : mockProducts.map(p => p.id));
  const toggleSelect = (id: number) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[var(--text-muted)] text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stat.value}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-[var(--text-muted)]">{stat.subtitle}</span>
                  {stat.change && <span className={`text-sm font-medium ${stat.change.startsWith('+') ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{stat.change}</span>}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[var(--background)] flex items-center justify-center text-[var(--text-muted)]">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <DashboardCard title="Filter" noPadding>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FilterDropdown label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'draft', label: 'Draft' }]} value={statusFilter} onChange={setStatusFilter} />
            <FilterDropdown label="Category" options={[{ value: 'jewelry', label: 'Jewelry' }, { value: 'accessories', label: 'Accessories' }, { value: 'home-decor', label: 'Home Decor' }]} value={categoryFilter} onChange={setCategoryFilter} />
            <FilterDropdown label="Stock" options={[{ value: 'in-stock', label: 'In Stock' }, { value: 'out-of-stock', label: 'Out of Stock' }]} value={stockFilter} onChange={setStockFilter} />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="w-full sm:w-80"><SearchInput placeholder="Search Product" value={searchQuery} onChange={setSearchQuery} /></div>
            <div className="flex items-center gap-3">
              <PageSizeDropdown value={pageSize} onChange={setPageSize} />
              <ExportButton />
              <AddButton label="Add Product" onClick={() => router.push('/products/new')} />
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* Table */}
      <DashboardCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-4 px-5 w-12"><TableCheckbox checked={selectedProducts.length === mockProducts.length} indeterminate={selectedProducts.length > 0 && selectedProducts.length < mockProducts.length} onChange={toggleSelectAll} /></th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Product</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Category</th>
                <th className="text-center py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Stock</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">SKU</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Price</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">QTY</th>
                <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockProducts.map((product) => (
                <tr key={product.id} className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors">
                  <td className="py-4 px-5"><TableCheckbox checked={selectedProducts.includes(product.id)} onChange={() => toggleSelect(product.id)} /></td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center"><Package className="w-5 h-5 text-[var(--text-muted)]" /></div>
                      <div><p className="font-medium text-[var(--text-primary)]">{product.name}</p><p className="text-sm text-[var(--text-muted)] truncate max-w-xs">{product.description}</p></div>
                    </div>
                  </td>
                  <td className="py-4 px-5"><CategoryBadge name={product.category} icon={product.categoryIcon} /></td>
                  <td className="py-4 px-5"><div className="flex justify-center"><StockIndicator inStock={product.inStock} /></div></td>
                  <td className="py-4 px-5 text-[var(--text-primary)]">{product.sku}</td>
                  <td className="py-4 px-5 text-[var(--text-primary)] font-medium">${product.price.toFixed(2)}</td>
                  <td className="py-4 px-5 text-[var(--text-primary)]">{product.qty}</td>
                  <td className="py-4 px-5"><StatusBadge status={product.status} /></td>
                  <td className="py-4 px-5"><TableActions onView={() => router.push(`/products/${product.id}`)} onEdit={() => router.push(`/products/${product.id}/edit`)} onDelete={() => console.log('Delete', product.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={10} totalItems={70} pageSize={pageSize} onPageChange={setCurrentPage} />
      </DashboardCard>
    </div>
  );
}

export default function ProductsPage() {
  return <DashboardLayout><ProductsContent /></DashboardLayout>;
}
