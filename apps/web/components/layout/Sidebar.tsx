'use client';

/**
 * Sidebar Component - Vuexy Style (Collapsible)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, createContext, useContext } from 'react';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Settings,
  BarChart3,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Sidebar context for collapse state
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

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
      { name: 'Schedules', href: '/schedules', icon: Calendar },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { name: 'Usage & Costs', href: '/usage', icon: BarChart3 },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const HELP_CARD_DISMISSED_KEY = 'sidebar_help_card_dismissed';

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelpCard, setShowHelpCard] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(HELP_CARD_DISMISSED_KEY);
    if (dismissed === 'true') {
      setShowHelpCard(false);
    }
  }, []);

  const dismissHelpCard = () => {
    setShowHelpCard(false);
    localStorage.setItem(HELP_CARD_DISMISSED_KEY, 'true');
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div
        className={cn(
          'h-screen flex flex-col bg-[var(--card-bg)] border-r border-[var(--border-color)] transition-all duration-300 relative',
          isCollapsed ? 'w-[80px]' : 'w-[260px]'
        )}
      >
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full gradient-primary text-white flex items-center justify-center shadow-lg z-50 hover:scale-110 transition-transform"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[var(--border-color)]">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            {!isCollapsed && (
              <span className="text-[var(--text-primary)] font-bold text-xl tracking-tight whitespace-nowrap">
                Etsy Auto
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
          {navigation.map((section, sectionIndex) => (
            <div key={sectionIndex} className={cn(sectionIndex > 0 && 'mt-6')}>
              {section.title && !isCollapsed && (
                <p className="px-3 mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {section.title}
                </p>
              )}
              {section.title && isCollapsed && (
                <div className="h-px bg-[var(--border-color)] mx-2 mb-3" />
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                        isCollapsed && 'justify-center px-2',
                        isActive
                          ? 'gradient-primary text-white shadow-lg'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
                      )}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-white')} />
                      {!isCollapsed && (
                        <span className="font-medium whitespace-nowrap">{item.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Help Card - Only show when expanded and not dismissed */}
        {!isCollapsed && showHelpCard && (
          <div className="p-4">
            <div className="bg-[var(--primary-bg)] rounded-xl p-4 relative">
              <button
                onClick={dismissHelpCard}
                className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center mb-3">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-[var(--text-primary)] font-semibold mb-1">Need Help?</h4>
              <p className="text-[var(--text-muted)] text-sm mb-3">
                Check our docs or contact support
              </p>
              <Link
                href="/docs"
                className="block w-full py-2 px-4 bg-white text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors text-center"
              >
                View Documentation
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={cn(
          'py-3 border-t border-[var(--border-color)]',
          isCollapsed ? 'px-2 text-center' : 'px-6'
        )}>
          {isCollapsed ? (
            <p className="text-xs text-[var(--text-muted)]">v1.0</p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Etsy Auto v1.0.0 • © 2024</p>
          )}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
