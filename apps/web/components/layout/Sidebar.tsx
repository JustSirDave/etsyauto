'use client';

/**
 * Sidebar Component - Vuexy Style
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Calendar,
  Settings,
  BarChart3,
  Sparkles,
  Users,
  Star,
  HelpCircle,
  ChevronDown,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
  children?: { name: string; href: string }[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'SHOP MANAGEMENT',
    items: [
      {
        name: 'Products',
        icon: Package,
        children: [
          { name: 'Product List', href: '/products' },
          { name: 'Add Product', href: '/products/new' },
          { name: 'Categories', href: '/products/categories' },
        ],
      },
      { name: 'Listings', href: '/listings', icon: FileText, badge: 'New', badgeColor: 'success' },
      {
        name: 'Orders',
        icon: ShoppingCart,
        badge: 12,
        badgeColor: 'primary',
        children: [
          { name: 'Order List', href: '/orders' },
          { name: 'Order Details', href: '/orders/details' },
        ],
      },
      { name: 'Customers', href: '/customers', icon: Users },
      { name: 'Reviews', href: '/reviews', icon: Star },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { name: 'Usage & Costs', href: '/usage', icon: BarChart3 },
      { name: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { name: 'Shop Settings', href: '/shop-settings', icon: Store },
      { name: 'Team', href: '/team', icon: Users },
      { name: 'Account', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Products', 'Orders']);

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const isActive = (href?: string, children?: { href: string }[]) => {
    if (href && pathname === href) return true;
    if (children) return children.some((child) => pathname === child.href);
    return false;
  };

  return (
    <div className="w-[260px] h-screen flex flex-col bg-[var(--card-bg)] border-r border-[var(--border-color)]">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[var(--border-color)]">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-[var(--primary)]/30">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <span className="text-[var(--text-primary)] font-bold text-xl tracking-tight">
            Etsy Auto
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
        {navigation.map((section, sectionIndex) => (
          <div key={sectionIndex} className={cn(sectionIndex > 0 && 'mt-6')}>
            {section.title && (
              <p className="px-3 mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.children);
                const expanded = expandedItems.includes(item.name);
                const hasChildren = item.children && item.children.length > 0;

                return (
                  <div key={item.name}>
                    {hasChildren ? (
                      // Expandable item
                      <button
                        onClick={() => toggleExpanded(item.name)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200',
                          active
                            ? 'sidebar-item-active text-[var(--primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge && (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                item.badgeColor === 'success' && 'bg-[var(--success-bg)] text-[var(--success)]',
                                item.badgeColor === 'primary' && 'bg-[var(--primary-bg)] text-[var(--primary)]',
                                item.badgeColor === 'warning' && 'bg-[var(--warning-bg)] text-[var(--warning)]',
                                item.badgeColor === 'danger' && 'bg-[var(--danger-bg)] text-[var(--danger)]'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 transition-transform duration-200',
                              expanded && 'rotate-180'
                            )}
                          />
                        </div>
                      </button>
                    ) : (
                      // Regular link
                      <Link
                        href={item.href || '#'}
                        className={cn(
                          'flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200',
                          active
                            ? 'sidebar-item-active text-[var(--primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              item.badgeColor === 'success' && 'bg-[var(--success-bg)] text-[var(--success)]',
                              item.badgeColor === 'primary' && 'bg-[var(--primary-bg)] text-[var(--primary)]',
                              item.badgeColor === 'warning' && 'bg-[var(--warning-bg)] text-[var(--warning)]',
                              item.badgeColor === 'danger' && 'bg-[var(--danger-bg)] text-[var(--danger)]'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Children */}
                    {hasChildren && expanded && (
                      <div className="mt-1 ml-8 space-y-1 animate-fade-in">
                        {item.children?.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                                childActive
                                  ? 'text-[var(--primary)] bg-[var(--primary-bg)]'
                                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]'
                              )}
                            >
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  childActive ? 'bg-[var(--primary)]' : 'bg-[var(--text-muted)]'
                                )}
                              />
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Help Card */}
      <div className="p-4">
        <div className="bg-[var(--primary-bg)] rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center mb-3">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <h4 className="text-[var(--text-primary)] font-semibold mb-1">Need Help?</h4>
          <p className="text-[var(--text-muted)] text-sm mb-3">
            Check our docs or contact support
          </p>
          <button className="w-full py-2 px-4 bg-white text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
            View Documentation
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-[var(--border-color)]">
        <p className="text-xs text-[var(--text-muted)]">Etsy Auto v1.0.0 • © 2024</p>
      </div>
    </div>
  );
}
