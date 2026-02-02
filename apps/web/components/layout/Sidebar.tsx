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
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';

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
  { name: 'nav.dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'nav.shopManagement',
    items: [
  { name: 'nav.products', href: '/products', icon: Package },
  { name: 'nav.listings', href: '/listings', icon: FileText },
  { name: 'nav.orders', href: '/orders', icon: ShoppingCart },
    ],
  },
  {
    title: 'nav.automation',
    items: [
      { name: 'nav.aiGeneration', href: '/ai', icon: Sparkles },
      { name: 'nav.aiReview', href: '/ai-review', icon: BookOpen },
  { name: 'nav.schedules', href: '/schedules', icon: Calendar },
    ],
  },
  {
    title: 'nav.settingsSection',
    items: [
      { name: 'nav.settings', href: '/settings', icon: Settings },
      { name: 'nav.auditLogs', href: '/audit', icon: Shield },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelpCard, setShowHelpCard] = useState(true);
  const { t } = useLanguage();

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
        className="absolute right-0 top-20 translate-x-1/2 w-6 h-6 bg-[var(--text-inverse)] text-[var(--primary)] border border-[var(--border-color)] rounded-full flex items-center justify-center shadow-lg hover:bg-[var(--text-inverse)] hover:text-[var(--primary-dark)] transition-colors z-50"
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
          'h-16 flex items-center border-b border-[var(--border-color)] relative z-10',
          isCollapsed ? 'justify-center px-2' : 'px-6'
        )}>
          <Link href="/" className="flex items-center gap-3 cursor-pointer pointer-events-auto">
            <div className="w-9 h-9 rounded-lg bg-[var(--text-inverse)] flex items-center justify-center flex-shrink-0">
              <span className="text-[var(--primary)] font-bold text-lg">E</span>
            </div>
            {!isCollapsed && (
              <span className="text-[var(--text-inverse)] font-bold text-xl tracking-tight">
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
              <p className="px-3 mb-2 text-xs font-semibold text-[var(--text-inverse)] opacity-60 uppercase tracking-wider">
                {t(section.title)}
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
                        ? 'bg-[var(--text-inverse)] text-[var(--primary)]'
                        : 'text-[var(--text-inverse)] opacity-80 hover:bg-[rgba(255,255,255,0.08)] hover:opacity-100'
              )}
                    title={isCollapsed ? t(item.name) : undefined}
            >
                    <Icon className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isActive ? 'text-[var(--primary)]' : 'text-[var(--text-inverse)] opacity-70 group-hover:opacity-100'
                    )} />
                    {!isCollapsed && (
              <span
                className={cn(
                  'font-medium opacity-80 group-hover:opacity-100',
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--text-inverse)]'
                )}
              >
                {t(item.name)}
              </span>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-3 py-1.5 bg-[var(--card-bg)] text-[var(--text-primary)] text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-[var(--border-color)]">
                        {t(item.name)}
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
          <div className="bg-[rgba(255,255,255,0.08)] border border-[var(--border-color)] rounded-xl p-4 relative">
            <button
              onClick={dismissHelpCard}
              className="absolute top-2 right-2 text-[var(--text-inverse-muted)] hover:text-[var(--text-inverse)] transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--text-inverse)] flex items-center justify-center flex-shrink-0">
                <LifeBuoy className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[var(--text-inverse)] font-semibold mb-1">{t('help.title')}</h4>
                <p className="text-[var(--text-inverse-muted)] text-sm mb-3">
                  {t('help.body')}
                </p>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-inverse)] hover:underline"
                >
                  <BookOpen className="w-4 h-4" />
                  {t('help.cta')}
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
            className="flex items-center justify-center w-full py-2.5 rounded-lg text-[var(--text-inverse-muted)] hover:text-[var(--text-inverse)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
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
        <p className="text-xs text-[var(--text-inverse-muted)]">
          {isCollapsed ? 'v1.0' : 'Etsy Auto v1.0.0'}
        </p>
      </div>
      </div>
    </div>
  );
}
