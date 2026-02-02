'use client';

import React, { useState, useEffect } from 'react';
import ErrorListTable from '@/components/errors/ErrorListTable';
import { useShop } from '@/lib/shop-context';

interface ErrorItem {
  id: number;
  jobId: number;
  productId?: number;
  shopId?: number;
  listingId?: string;
  errorCode: string;
  errorMessage: string;
  status: string;
  createdAt: string;
  productName?: string;
  shopName?: string;
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedShopId } = useShop();

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedShopId) {
        params.append('shop_id', String(selectedShopId));
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/listings/errors${query}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setErrors(data.errors || []);
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      const response = await fetch(`/api/listings/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh errors list
        fetchErrors();
      } else {
        alert('Failed to retry job');
      }
    } catch (error) {
      console.error('Failed to retry job:', error);
      alert('Failed to retry job');
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [selectedShopId]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Errors & Issues</h1>
        <p className="mt-2 text-gray-600">
          View and resolve errors from listing publications and order syncs
        </p>
      </div>

      <ErrorListTable
        errors={errors}
        onRetry={handleRetry}
        onRefresh={fetchErrors}
        loading={loading}
      />
    </div>
  );
}

