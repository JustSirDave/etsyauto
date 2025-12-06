'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Package, ShoppingCart, Settings, X, Sparkles, Calendar, BarChart3 } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  category: string;
}

const searchablePages: SearchResult[] = [
  {
    title: 'Dashboard',
    description: 'View your shop overview and metrics',
    icon: BarChart3,
    href: '/',
    category: 'Pages',
  },
  {
    title: 'Products',
    description: 'Manage your product catalog',
    icon: Package,
    href: '/products',
    category: 'Pages',
  },
  {
    title: 'Listings',
    description: 'View and manage your Etsy listings',
    icon: FileText,
    href: '/listings',
    category: 'Pages',
  },
  {
    title: 'Orders',
    description: 'Track and manage customer orders',
    icon: ShoppingCart,
    href: '/orders',
    category: 'Pages',
  },
  {
    title: 'AI Generation',
    description: 'Generate product titles, descriptions, and tags',
    icon: Sparkles,
    href: '/ai',
    category: 'Pages',
  },
  {
    title: 'Schedules',
    description: 'Automate tasks with scheduled jobs',
    icon: Calendar,
    href: '/schedules',
    category: 'Pages',
  },
  {
    title: 'Usage & Costs',
    description: 'Monitor AI usage and costs',
    icon: BarChart3,
    href: '/usage',
    category: 'Analytics',
  },
  {
    title: 'Settings',
    description: 'Configure your shop and team settings',
    icon: Settings,
    href: '/settings',
    category: 'Settings',
  },
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>(searchablePages);
  const router = useRouter();

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Filter results based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults(searchablePages);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = searchablePages.filter(
      (page) =>
        page.title.toLowerCase().includes(lowerQuery) ||
        page.description.toLowerCase().includes(lowerQuery) ||
        page.category.toLowerCase().includes(lowerQuery)
    );

    setResults(filtered);
  }, [query]);

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
      setQuery('');
    },
    [router, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] w-full max-w-2xl mx-4 shadow-2xl animate-fade-in">
        {/* Search Input */}
        <div className="relative border-b border-[var(--border-color)]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, features, settings..."
            autoFocus
            className="w-full pl-12 pr-12 py-4 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none text-lg"
          />
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--background)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">No results found for "{query}"</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Try searching for pages, features, or settings</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => {
                const Icon = result.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(result.href)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-[var(--background)] rounded-lg transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--primary)] transition-colors">
                      <Icon className="w-5 h-5 text-[var(--primary)] group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[var(--text-primary)] font-medium">{result.title}</h3>
                        <span className="text-xs px-2 py-0.5 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--text-muted)]">
                          {result.category}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] truncate">{result.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-color)] px-4 py-3 bg-[var(--background)] rounded-b-xl">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-4">
              <span>Press <kbd className="px-2 py-0.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded">↑↓</kbd> to navigate</span>
              <span>Press <kbd className="px-2 py-0.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded">Enter</kbd> to select</span>
            </div>
            <span>Press <kbd className="px-2 py-0.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded">ESC</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
