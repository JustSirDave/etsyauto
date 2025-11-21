'use client'

/**
 * Dashboard Home Page
 * Main landing page after login
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-dark-muted mt-1">Welcome back! Here's your shop overview.</p>
            </div>

            {/* Connection Status Section */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Connection Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ConnectionStatus
                  title="Etsy Shop"
                  status="connected"
                  shopName="MyDesignStore"
                />
                <ConnectionStatus
                  title="Supplier API"
                  status="not_connected"
                />
              </div>
            </section>

            {/* Recent Orders Section */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Recent Orders</h2>
              <RecentOrders />
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
