'use client'

import { LogOut, User, Building2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export function TopBar() {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* User Menu */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-dark-bg">
            <User className="w-5 h-5 text-dark-muted" />
            <div className="flex flex-col">
              <span className="text-sm text-white">{user?.name || 'User'}</span>
              <span className="text-xs text-dark-muted flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {user?.tenant_name || 'Organization'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  )
}
