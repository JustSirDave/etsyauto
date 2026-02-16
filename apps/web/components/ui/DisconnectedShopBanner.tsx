'use client';

import { useShop } from '@/lib/shop-context';
import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export function DisconnectedShopBanner() {
  const { selectedShops } = useShop();

  const disconnectedShops = selectedShops.filter((s) => s.status === 'revoked');

  if (disconnectedShops.length === 0) return null;

  const names = disconnectedShops.map((s) => s.display_name || `Shop ${s.id}`).join(', ');

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
      <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <p className="text-amber-300 flex-1">
        <span className="font-medium">{names}</span>
        {disconnectedShops.length === 1 ? ' is' : ' are'} disconnected. Data for{' '}
        {disconnectedShops.length === 1 ? 'this shop' : 'these shops'} won&apos;t sync until reconnected.
      </p>
      <Link
        href="/settings?tab=shops"
        className="text-amber-300 hover:text-amber-200 underline font-medium flex-shrink-0"
      >
        Reconnect
      </Link>
    </div>
  );
}
