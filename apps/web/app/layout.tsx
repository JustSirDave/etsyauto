import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Etsy Automation Platform',
  description: 'AI-assisted, policy-compliant automation for Etsy sellers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-dark-bg text-dark-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
