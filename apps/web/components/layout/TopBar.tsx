'use client';

/**
 * TopBar Component - Enhanced with Search, Language Switching, and Profile Settings
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useShop } from '@/lib/shop-context';
import { ProfileSettingsModal } from '@/components/profile/ProfileSettingsModal';
import { SearchModal } from '@/components/layout/SearchModal';
import { NotificationPanel } from '@/components/layout/NotificationPanel';
import { notificationsApi } from '@/lib/api';
import {
  Search,
  ChevronDown,
  LogOut,
  User,
  Settings,
  BookOpen,
  Globe,
  Bell,
  Store,
  CheckSquare,
  Square,
  WifiOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { shops, selectedShopIds, toggleShopId, selectAllShops, clearAllShops, isLoading: shopsLoading } = useShop();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [disconnectedPromptShopId, setDisconnectedPromptShopId] = useState<number | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showShopMenu, setShowShopMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await logout();
  };

  // Load unread notification count
  useEffect(() => {
    loadUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const data = await notificationsApi.getUnreadCount();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  // Global keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'he', name: 'עברית', flag: '🇮🇱' },
  ];

  const currentLanguage = languages.find((lang) => lang.code === language) || languages[0];

  return (
    <>
      <header className="h-16 bg-[var(--card-bg)] border-b border-[var(--border-color)] flex items-center justify-between px-6">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
            <button
              onClick={() => setShowSearchModal(true)}
              className="w-full pl-12 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)] hover:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition text-left"
            >
              {t('topbar.search')}
            </button>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-xs text-[var(--text-muted)]">
              ⌘ K
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Multi-Store Selector */}
          <div className="relative">
            <button
              onClick={() => setShowShopMenu(!showShopMenu)}
              className="flex items-center gap-2 px-3 h-10 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors min-w-[180px] border border-[var(--border-color)]"
              title={t('topbar.selectShop')}
              disabled={shopsLoading}
            >
              <Store className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium flex-1 text-left truncate">
                {shopsLoading
                  ? 'Loading...'
                  : shops.length === 0
                    ? 'No shop connected'
                    : selectedShopIds.length === shops.length
                      ? 'All shops'
                      : selectedShopIds.length === 1
                        ? (shops.find((s) => s.id === selectedShopIds[0])?.display_name || `Shop ${selectedShopIds[0]}`)
                        : `${selectedShopIds.length} shops`}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showShopMenu ? 'rotate-180' : ''}`} />
            </button>

            {showShopMenu && shops.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShopMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                  {/* Quick actions */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)]">
                    <button
                      onClick={selectAllShops}
                      className="text-xs px-2 py-1 rounded bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Select all
                    </button>
                    <button
                      onClick={clearAllShops}
                      className="text-xs px-2 py-1 rounded bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Clear
                    </button>
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      {selectedShopIds.length}/{shops.length}
                    </span>
                  </div>
                  <div className="py-1 max-h-60 overflow-y-auto">
                    {shops.map((shop) => {
                      const isSelected = selectedShopIds.includes(shop.id);
                      const isDisconnected = shop.status === 'revoked';
                      return (
                        <div key={shop.id}>
                          <button
                            onClick={() => {
                              toggleShopId(shop.id);
                              if (isDisconnected && !isSelected) {
                                setDisconnectedPromptShopId(shop.id);
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-[var(--primary-bg)] text-[var(--primary)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
                            } ${isDisconnected ? 'opacity-60' : ''}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 flex-shrink-0" />
                            )}
                            <span className={`font-medium truncate flex-1 ${isDisconnected ? 'line-through' : ''}`}>
                              {shop.display_name || `Shop ${shop.id}`}
                            </span>
                            {isDisconnected && (
                              <span title="Disconnected"><WifiOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /></span>
                            )}
                          </button>
                          {disconnectedPromptShopId === shop.id && isDisconnected && (
                            <div className="mx-4 mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                              <p className="text-amber-400 mb-1.5">This shop is disconnected. Data won&apos;t sync.</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowShopMenu(false);
                                  setDisconnectedPromptShopId(null);
                                  router.push('/settings?tab=shops');
                                }}
                                className="text-amber-300 hover:text-amber-200 underline font-medium"
                              >
                                Reconnect
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center gap-2 px-3 h-10 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors"
              title={t('topbar.changeLanguage')}
            >
              <Globe className="w-5 h-5" />
              <span className="text-sm font-medium">{currentLanguage.code.toUpperCase()}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showLanguageMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Language Dropdown */}
            {showLanguageMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLanguageMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="py-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as 'en' | 'he');
                          setShowLanguageMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          language === lang.code
                            ? 'bg-[var(--primary-bg)] text-[var(--primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {language === lang.code && (
                          <span className="ml-auto text-[var(--primary)]">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[var(--primary)] text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationPanel
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              unreadCount={unreadCount}
              onCountChange={setUnreadCount}
            />
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--background)] transition-colors"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[var(--border-color)]">
                {user?.profile_picture_url ? (
                  <img
                    src={
                      user.profile_picture_url.startsWith('http')
                        ? user.profile_picture_url
                        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}${user.profile_picture_url}`
                    }
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full gradient-primary flex items-center justify-center text-white font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        {user?.profile_picture_url ? (
                          <img
                            src={
                              user.profile_picture_url.startsWith('http')
                                ? user.profile_picture_url
                                : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}${user.profile_picture_url}`
                            }
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-[var(--primary)] flex items-center justify-center text-white font-semibold">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-primary)] font-semibold truncate">{user?.name}</p>
                        <p className="text-[var(--text-muted)] text-sm truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Profile Settings</span>
                    </button>
                    <a
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Shop Settings</span>
                    </a>
                    <a
                      href="/docs"
                      className="flex items-center gap-3 px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Documentation</span>
                    </a>
                  </div>

                  {/* Logout */}
                  <div className="p-2 border-t border-[var(--border-color)]">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-primary)] hover:bg-[var(--background)] rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <ProfileSettingsModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </>
  );
}
