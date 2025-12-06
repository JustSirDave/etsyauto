'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ConnectionStatus } from '@/components/dashboard/ConnectionStatus'
import { RecentOrders } from '@/components/dashboard/RecentOrders'

function DashboardContent() {
  return (
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
  )
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  )
}
