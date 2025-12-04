'use client';

/**
 * TopBar Component - Vuexy Style
 */

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ProfilePictureModal } from '@/components/profile/ProfilePictureModal';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Globe,
  Grid3X3,
  ChevronDown,
  LogOut,
  User,
  Settings,
  BookOpen,
} from 'lucide-react';

export function TopBar() {
  const { user, logout } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <header className="h-16 bg-[var(--card-bg)] border-b border-[var(--border-color)] flex items-center justify-between px-6">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search [CTRL + K]"
              className="w-full pl-12 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-xs text-[var(--text-muted)]">
              ⌘ K
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Language */}
          <button className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors">
            <span className="text-sm font-medium">EN</span>
          </button>

          {/* Theme Toggle */}
          <button className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors">
            <Moon className="w-5 h-5" />
          </button>

          {/* Grid Menu */}
          <button className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors">
            <Grid3X3 className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <button className="relative w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--danger)] rounded-full" />
          </button>

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
                <div className="absolute right-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
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
                          <div className="w-full h-full gradient-primary flex items-center justify-center text-white font-semibold">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[var(--text-primary)] font-semibold">{user?.name}</p>
                        <p className="text-[var(--text-muted)] text-sm">{user?.email}</p>
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
                      <span>My Profile</span>
                    </button>
                    <a
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
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
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-lg transition-colors"
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

      <ProfilePictureModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
