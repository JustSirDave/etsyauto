"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

interface PendingReviewsCardProps {
  className?: string;
}

export function AIPendingReviewsCard({ className = "" }: PendingReviewsCardProps) {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingCount = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generations/pending-review?limit=1`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPendingCount(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch pending reviews count:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/ai-review"
      className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 block ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-100 rounded-lg mr-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-700">AI Content Review</h3>
        </div>
        {pendingCount > 0 && (
          <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            {pendingCount}
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900">{pendingCount}</div>
        <p className="text-sm text-gray-500 mt-1">
          {pendingCount === 0
            ? "No items need review"
            : pendingCount === 1
            ? "Item needs review"
            : "Items need review"}
        </p>
      </div>

      {pendingCount > 0 ? (
        <div className="flex items-center text-sm text-yellow-600 font-medium">
          <Sparkles className="w-4 h-4 mr-1" />
          <span>Review AI-generated content</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      ) : (
        <div className="flex items-center text-sm text-gray-500">
          <span>All content reviewed</span>
        </div>
      )}
    </Link>
  );
}

