'use client'

/**
 * Dashboard Home Page
 * Main landing page after login
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { Package, ShoppingBag, Sparkles, DollarSign, TrendingUp, Users } from 'lucide-react'

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
            {/* Dashboard Header - Full Width */}
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-dark-muted mt-1">Welcome back! Here's your shop overview.</p>
            </div>

            {/* Two Column Layout: Connection Status + Quick Actions | Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Connection Status + Quick Actions */}
              <div className="flex flex-col gap-4">
                {/* Connection Status - 2 Cards Side by Side */}
                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-white">Connection Status</h2>
                  <div className="grid grid-cols-2 gap-3">
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
                </div>

                {/* Quick Actions - 3 Cards Side by Side */}
                <div className="flex flex-col gap-3 flex-1">
                  <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
                  <div className="grid grid-cols-3 gap-3 content-start">
                    <button
                      onClick={() => router.push('/products')}
                      className="bg-slate-800 hover:bg-slate-750 rounded-lg p-3 text-left transition-colors border border-slate-700 hover:border-teal-500 group"
                    >
                      <div className="p-2 bg-teal-500/10 group-hover:bg-teal-500/20 rounded-lg transition-colors mb-2 w-fit">
                        <Package className="w-4 h-4 text-teal-400" />
                      </div>
                      <h3 className="text-white font-semibold text-sm mb-1">Import Products</h3>
                      <p className="text-xs text-slate-400">Upload CSV</p>
                    </button>

                    <button
                      onClick={() => router.push('/ai')}
                      className="bg-slate-800 hover:bg-slate-750 rounded-lg p-3 text-left transition-colors border border-slate-700 hover:border-purple-500 group"
                    >
                      <div className="p-2 bg-purple-500/10 group-hover:bg-purple-500/20 rounded-lg transition-colors mb-2 w-fit">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                      </div>
                      <h3 className="text-white font-semibold text-sm mb-1">AI Content</h3>
                      <p className="text-xs text-slate-400">Generate</p>
                    </button>

                    <button
                      onClick={() => router.push('/settings')}
                      className="bg-slate-800 hover:bg-slate-750 rounded-lg p-3 text-left transition-colors border border-slate-700 hover:border-blue-500 group"
                    >
                      <div className="p-2 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-lg transition-colors mb-2 w-fit">
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-white font-semibold text-sm mb-1">Connect Etsy</h3>
                      <p className="text-xs text-slate-400">Link shop</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Key Metrics in 2x2 Grid */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-white">Key Metrics</h2>
                <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Package className="w-5 h-5 text-blue-400" />
                      </div>
                      <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +12%
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">0</p>
                      <p className="text-sm text-slate-400 mt-1">Total Products</p>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-teal-500/10 rounded-lg">
                        <ShoppingBag className="w-5 h-5 text-teal-400" />
                      </div>
                      <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +8%
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">0</p>
                      <p className="text-sm text-slate-400 mt-1">Active Listings</p>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Today</span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">0</p>
                      <p className="text-sm text-slate-400 mt-1">AI Generations</p>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-400" />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">This month</span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">$0.00</p>
                      <p className="text-sm text-slate-400 mt-1">AI Costs</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders Section - Full Width Below */}
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
