'use client'

import { useState } from 'react'
import { LogOut, User, Building2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ProfilePictureModal } from '@/components/profile/ProfilePictureModal'

export function TopBar() {
  const { user, logout } = useAuth()
  const [showProfileModal, setShowProfileModal] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  return (
    <>
      <div className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-dark-bg hover:bg-slate-700 transition-colors group"
            >
              {/* Profile Picture or Default Icon */}
              <div className="relative w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600 group-hover:border-teal-500 transition-colors">
                {user?.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url.startsWith('http') ? user.profile_picture_url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}${user.profile_picture_url}`}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to default icon if image fails to load
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : (
                  <User className="w-5 h-5 text-dark-muted" />
                )}
                <User className="w-5 h-5 text-dark-muted hidden" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm text-white">{user?.name || 'User'}</span>
                <span className="text-xs text-dark-muted flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {user?.tenant_name || 'Organization'}
                </span>
              </div>
            </button>

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

      {/* Profile Picture Modal */}
      <ProfilePictureModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  )
}
