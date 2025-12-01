'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'

interface ConnectionStatusProps {
  title: string
  status: 'connected' | 'not_connected'
  shopName?: string
}

export function ConnectionStatus({ title, status, shopName }: ConnectionStatusProps) {
  const router = useRouter()
  const isConnected = status === 'connected'

  const handleConnect = () => {
    // Navigate to settings page where users can connect their supplier API
    router.push('/settings')
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          {isConnected && shopName && (
            <div className="text-dark-muted text-xs mt-1">
              {shopName}
            </div>
          )}
        </div>

        {!isConnected && (
          <button 
            onClick={handleConnect}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}
