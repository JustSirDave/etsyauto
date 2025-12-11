'use client';

/**
 * Sidebar Component - Collapsible with Sections
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Calendar,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  X,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Listings', href: '/listings', icon: FileText },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
    ],
  },
  {
    title: 'AUTOMATION',
    items: [
      { name: 'AI Generation', href: '/ai', icon: Sparkles },
      { name: 'AI Review', href: '/ai-review', icon: BookOpen },
  { name: 'Schedules', href: '/schedules', icon: Calendar },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
  { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelpCard, setShowHelpCard] = useState(true);

  // Load saved state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }
    const helpDismissed = localStorage.getItem('helpCardDismissed');
    if (helpDismissed === 'true') {
      setShowHelpCard(false);
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  const dismissHelpCard = () => {
    setShowHelpCard(false);
    localStorage.setItem('helpCardDismissed', 'true');
  };

  return (
    <div className="relative">
      {/* Collapse Toggle Button - Outside main container */}
      <button
        onClick={toggleSidebar}
        className="absolute right-0 top-20 translate-x-1/2 w-6 h-6 bg-[var(--primary)] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[var(--primary-dark)] transition-colors z-50"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      <div
        className={cn(
          'h-screen flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] transition-all duration-300 ease-in-out overflow-y-auto',
          isCollapsed ? 'w-[60px]' : 'w-[240px]'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-[var(--border-color)]',
          isCollapsed ? 'justify-center px-2' : 'px-6'
        )}>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-[var(--primary)]/30 flex-shrink-0">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            {!isCollapsed && (
              <span className="text-[var(--text-primary)] font-bold text-xl tracking-tight">
                Etsy Auto
              </span>
            )}
          </Link>
        </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 custom-scrollbar">
        {navigation.map((section, sectionIndex) => (
          <div key={sectionIndex} className={cn(sectionIndex > 0 && 'mt-6')}>
            {section.title && !isCollapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {section.title && isCollapsed && (
              <div className="h-px bg-[var(--border-color)] mx-2 mb-2" />
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                      isCollapsed && 'justify-center',
                isActive
                        ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--info)] text-white shadow-md shadow-[var(--primary)]/30'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
              )}
                    title={isCollapsed ? item.name : undefined}
            >
                    <Icon className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isActive ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                    )} />
                    {!isCollapsed && (
              <span className="font-medium">{item.name}</span>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-3 py-1.5 bg-[var(--card-bg)] text-[var(--text-primary)] text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-[var(--border-color)]">
                        {item.name}
                      </div>
                    )}
            </Link>
                );
        })}
            </div>
          </div>
        ))}
      </nav>

      {/* Help & Documentation Card */}
      {!isCollapsed && showHelpCard && (
        <div className="p-4">
          <div className="bg-gradient-to-br from-[var(--primary-bg)] to-[var(--info-bg)] border border-[var(--primary)]/30 rounded-xl p-4 relative">
            <button
              onClick={dismissHelpCard}
              className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                <LifeBuoy className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[var(--text-primary)] font-semibold mb-1">Need Help?</h4>
                <p className="text-[var(--text-muted)] text-sm mb-3">
                  Check our docs for guides and tutorials
                </p>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  <BookOpen className="w-4 h-4" />
                  View Docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Help Icon */}
      {isCollapsed && (
        <div className="p-3">
          <Link
            href="/docs"
            className="flex items-center justify-center w-full py-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors"
            title="Documentation"
          >
            <BookOpen className="w-5 h-5" />
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className={cn(
        'py-3 border-t border-[var(--border-color)]',
        isCollapsed ? 'px-2 text-center' : 'px-6'
      )}>
        <p className="text-xs text-[var(--text-muted)]">
          {isCollapsed ? 'v1.0' : 'Etsy Auto v1.0.0'}
        </p>
      </div>
      </div>
    </div>
  );
}
