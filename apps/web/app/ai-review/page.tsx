'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AI Review feature removed for Etsy API ToU compliance.
 * Redirect to owner dashboard.
 */
export default function AIReviewPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/owner');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
    </div>
  );
}
