'use client';

/**
 * AI Generation History Page
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SearchInput, PageSizeDropdown, Pagination } from '@/components/ui/DataTable';
import { History, CheckCircle, XCircle, Eye, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, AIGeneration } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

function StatusBadge({ status }: { status: string }) {
  const styles = {
    completed: 'bg-[var(--success-bg)] text-[var(--success)]',
    failed: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', styles[status as keyof typeof styles] || styles.completed)}>
      {status === 'completed' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AIHistoryContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [generations, setGenerations] = useState<AIGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadGenerations();
  }, []);

  const loadGenerations = async () => {
    try {
      setLoading(true);
      // Load all generations (you might want to add pagination to the backend later)
      const data = await aiApi.getRecentGenerations(100);
      setGenerations(data.generations);
    } catch (error: any) {
      console.error('Failed to load AI generations:', error);
      showToast(error.detail || 'Failed to load AI generation history', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter generations by search query
  const filteredGenerations = generations.filter(gen => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      gen.title.toLowerCase().includes(query) ||
      gen.product_id.toString().includes(query)
    );
  });

  // Paginate filtered results
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGenerations = filteredGenerations.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredGenerations.length / pageSize);

  const handleViewProduct = (productId: number) => {
    router.push(`/products/${productId}`);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/ai')}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <History className="w-8 h-8 text-[var(--primary)]" />
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">AI Generation History</h1>
            <p className="text-[var(--text-muted)] mt-1">
              View all past AI content generations
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm mb-1">Total Generations</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{generations.length}</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm mb-1">Successful</p>
          <p className="text-3xl font-bold text-[var(--success)]">
            {generations.filter(g => g.status === 'completed').length}
          </p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-5">
          <p className="text-[var(--text-muted)] text-sm mb-1">Total Cost</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            ${(generations.reduce((sum, g) => sum + (g.cost_usd_cents || 0), 0) / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* History Table */}
      <DashboardCard noPadding>
        <div className="p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[var(--border-color)]">
          <div className="w-full sm:w-96">
            <SearchInput
              placeholder="Search by title or product ID..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <PageSizeDropdown value={pageSize} onChange={(val) => { setPageSize(val); setCurrentPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paginatedGenerations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <History className="w-12 h-12 text-[var(--text-muted)] opacity-50 mb-3" />
              <p className="text-[var(--text-muted)] text-lg">No AI generations found</p>
              {searchQuery && (
                <p className="text-[var(--text-muted)] text-sm mt-2">Try adjusting your search query</p>
              )}
              {!searchQuery && generations.length === 0 && (
                <button
                  onClick={() => router.push('/ai')}
                  className="mt-4 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Generate AI Content
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Product
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="text-right py-4 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedGenerations.map((gen) => (
                  <tr
                    key={gen.id}
                    className="border-b border-[var(--border-color)] hover:bg-[var(--background)] transition-colors"
                  >
                    <td className="py-4 px-5">
                      <div>
                        <p className="font-medium text-[var(--text-primary)] truncate max-w-md">
                          {gen.title}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">
                          Product ID: {gen.product_id}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex px-2.5 py-1 bg-[var(--primary-bg)] text-[var(--primary)] rounded-md text-xs font-medium capitalize">
                        {gen.type}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-sm text-[var(--text-muted)]">
                      {gen.timestamp}
                    </td>
                    <td className="py-4 px-5">
                      <StatusBadge status={gen.status} />
                    </td>
                    <td className="py-4 px-5 text-sm font-medium text-[var(--text-primary)]">
                      ${((gen.cost_usd_cents || 0) / 100).toFixed(4)}
                    </td>
                    <td className="py-4 px-5 text-sm text-[var(--text-muted)]">
                      {gen.cost_tokens?.toLocaleString() || 0}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewProduct(gen.product_id)}
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--card-bg)] rounded-lg transition-colors"
                          title="View Product"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && paginatedGenerations.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredGenerations.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </DashboardCard>
    </div>
  );
}

export default function AIHistoryPage() {
  return (
    <DashboardLayout>
      <AIHistoryContent />
    </DashboardLayout>
  );
}
