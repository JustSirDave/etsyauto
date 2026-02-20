import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';
import { Providers } from './providers';

const fontClass = 'font-sans';

export const metadata: Metadata = {
  title: 'Etsy Automation Platform',
  description: 'AI-powered automation exclusively for Etsy sellers - Manage listings, generate content, and sync orders',
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
      <body className={fontClass}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
