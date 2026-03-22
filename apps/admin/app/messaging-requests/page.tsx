'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import {
  getMessagingRequests,
  approveMessaging,
  denyMessaging,
  type Tenant,
} from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900 text-yellow-400',
  approved: 'bg-green-900 text-green-400',
  denied: 'bg-red-900 text-red-400',
}

export default function MessagingRequestsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getMessagingRequests()
      setTenants(data)
    } catch {
      setError('Failed to load messaging requests.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(tenantId: number) {
    setActionLoading(tenantId)
    try {
      await approveMessaging(tenantId)
      await load()
    } catch {
      setError('Failed to approve. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeny(tenantId: number) {
    setActionLoading(tenantId)
    try {
      await denyMessaging(tenantId)
      await load()
    } catch {
      setError('Failed to deny. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-1">Messaging Requests</h1>
        <p className="text-gray-400 text-sm mb-8">
          Review and manage messaging automation access requests
        </p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}

        {!loading && !error && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Organization</th>
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Owner</th>
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Tier</th>
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Shops</th>
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Status</th>
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Requested</th>
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4 text-white font-medium">{tenant.name}</td>
                    <td className="px-5 py-4 text-gray-300">{tenant.owner_email}</td>
                    <td className="px-5 py-4 text-gray-300 capitalize">{tenant.billing_tier}</td>
                    <td className="px-5 py-4 text-gray-300">{tenant.shop_count}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[tenant.messaging_access] || ''}`}>
                        {tenant.messaging_access}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      {tenant.messaging_access === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(tenant.id)}
                            disabled={actionLoading === tenant.id}
                            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            {actionLoading === tenant.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleDeny(tenant.id)}
                            disabled={actionLoading === tenant.id}
                            className="px-3 py-1.5 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            {actionLoading === tenant.id ? '...' : 'Deny'}
                          </button>
                        </div>
                      )}
                      {tenant.messaging_access === 'approved' && (
                        <button
                          onClick={() => handleDeny(tenant.id)}
                          disabled={actionLoading === tenant.id}
                          className="px-3 py-1.5 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                      {tenant.messaging_access === 'denied' && (
                        <button
                          onClick={() => handleApprove(tenant.id)}
                          disabled={actionLoading === tenant.id}
                          className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Re-approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      No messaging requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
