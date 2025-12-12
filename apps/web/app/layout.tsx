import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { useEffect } from 'react';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Etsy Automation Platform',
  description: 'Automate your Etsy store operations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Sentry initialization */}
        <Script
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
                import('/lib/sentry').then(module => module.initSentryClient());
              }
            `
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
