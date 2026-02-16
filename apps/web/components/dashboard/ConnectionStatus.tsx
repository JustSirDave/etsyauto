'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import { shopsApi } from '@/lib/api'

interface ConnectionStatusProps {
  title: string
  status: 'connected' | 'not_connected'
  shopName?: string
}

export function ConnectionStatus({ title, status, shopName }: ConnectionStatusProps) {
  const router = useRouter()
  const isConnected = status === 'connected'
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      setCopying(true)
      const { connect_url } = await shopsApi.createConnectLink()
      await navigator.clipboard.writeText(connect_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 4000)
    } catch {
      router.push('/settings')
    } finally {
      setCopying(false)
    }
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
            onClick={handleCopyLink}
            disabled={copying}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        )}
      </div>
    </div>
  )
}
