import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { shopsApi, Shop } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STORAGE_KEY = 'selectedShopId';

interface ShopContextValue {
  shops: Shop[];
  selectedShopId: number | null;
  selectedShop: Shop | null;
  isLoading: boolean;
  setSelectedShopId: (shopId: number | null) => void;
  refreshShops: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshShops = async () => {
    try {
      setIsLoading(true);
      const data = await shopsApi.getAll();
      setShops(data);

      const stored = window.localStorage.getItem(STORAGE_KEY);
      const storedId = stored ? Number(stored) : null;
      const hasStored = storedId && data.some((shop) => shop.id === storedId);

      if (hasStored) {
        setSelectedShopIdState(storedId);
      } else if (data.length > 0) {
        setSelectedShopIdState(data[0].id);
        window.localStorage.setItem(STORAGE_KEY, String(data[0].id));
      } else {
        setSelectedShopIdState(null);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      setShops([]);
      setSelectedShopIdState(null);
      setIsLoading(false);
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    refreshShops();
  }, [authLoading, isAuthenticated]);

  const setSelectedShopId = (shopId: number | null) => {
    setSelectedShopIdState(shopId);
    if (shopId) {
      window.localStorage.setItem(STORAGE_KEY, String(shopId));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const selectedShop = useMemo(() => {
    if (!selectedShopId) return null;
    return shops.find((shop) => shop.id === selectedShopId) || null;
  }, [shops, selectedShopId]);

  const value = useMemo(
    () => ({
      shops,
      selectedShopId,
      selectedShop,
      isLoading,
      setSelectedShopId,
      refreshShops,
    }),
    [shops, selectedShopId, selectedShop, isLoading]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return ctx;
}
