'use client'

import { CheckCircle, XCircle } from 'lucide-react'

interface ConnectionStatusProps {
  title: string
  status: 'connected' | 'not_connected'
  shopName?: string
}

export function ConnectionStatus({ title, status, shopName }: ConnectionStatusProps) {
  const isConnected = status === 'connected'

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            Status:
          </span>
          <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {isConnected && shopName && (
          <div className="text-dark-muted text-sm">
            {shopName}
          </div>
        )}

        {!isConnected && (
          <button className="mt-4 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">
            Connect
          </button>
        )}
      </div>
    </div>
  )
}
