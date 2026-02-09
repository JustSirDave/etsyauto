"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Edit3, AlertTriangle, Sparkles, Clock, Tag } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface PolicyViolation {
  type: string;
  message: string;
  field?: string;
  severity?: string;
  location?: string;
}

interface PolicyFlags {
  violations: PolicyViolation[];
  suggestions?: string[];
  modified_by_user?: boolean;
}

interface PendingReview {
  id: number;
  product_id: number;
  title: string;
  description: string;
  tags: string[];
  policy_status: string;
  policy_flags: PolicyFlags;
  provider: string;
  created_at: string;
}

interface ModifyFormData {
  title: string;
  description: string;
  tags: string;
}

export default function AIReviewPage() {
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyForm, setModifyForm] = useState<ModifyFormData>({
    title: "",
    description: "",
    tags: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch pending reviews
  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generations/pending-review?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPendingReviews(data.pending_reviews || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (generationId: number) => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generations/${generationId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        // Remove from pending list
        setPendingReviews((prev) => prev.filter((r) => r.id !== generationId));
        setSelectedReview(null);
      } else {
        alert("Failed to accept generation");
      }
    } catch (error) {
      console.error("Failed to accept:", error);
      alert("Error accepting generation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (generationId: number) => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generations/${generationId}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        // Remove from pending list
        setPendingReviews((prev) => prev.filter((r) => r.id !== generationId));
        setSelectedReview(null);
      } else {
        alert("Failed to reject generation");
      }
    } catch (error) {
      console.error("Failed to reject:", error);
      alert("Error rejecting generation");
    } finally {
      setActionLoading(false);
    }
  };

  const openModifyModal = (review: PendingReview) => {
    setModifyForm({
      title: review.title,
      description: review.description,
      tags: review.tags.join(", "),
    });
    setShowModifyModal(true);
  };

  const handleModify = async () => {
    if (!selectedReview) return;

    setActionLoading(true);
    try {
      const tagsArray = modifyForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      const params = new URLSearchParams({
        title: modifyForm.title,
        description: modifyForm.description,
        tags: tagsArray.join(","),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/generations/${selectedReview.id}/modify?${params}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // If still has violations, update in place
        if (data.policy_status === "failed" || data.policy_status === "needs_review") {
          setPendingReviews((prev) =>
            prev.map((r) =>
              r.id === selectedReview.id
                ? {
                    ...r,
                    title: data.title,
                    description: data.description,
                    tags: data.tags,
                    policy_status: data.policy_status,
                    policy_flags: data.policy_flags,
                  }
                : r
            )
          );
          setSelectedReview({
            ...selectedReview,
            title: data.title,
            description: data.description,
            tags: data.tags,
            policy_status: data.policy_status,
            policy_flags: data.policy_flags,
          });
        } else {
          // Passed! Remove from list
          setPendingReviews((prev) => prev.filter((r) => r.id !== selectedReview.id));
          setSelectedReview(null);
        }

        setShowModifyModal(false);
      } else {
        alert("Failed to modify generation");
      }
    } catch (error) {
      console.error("Failed to modify:", error);
      alert("Error modifying generation");
    } finally {
      setActionLoading(false);
    }
  };

  const getPolicySeverityColor = (severity?: string) => {
    if (severity === "critical") return "text-[var(--danger)] bg-[var(--danger-bg)]";
    if (severity === "warning") return "text-[var(--warning)] bg-[var(--warning-bg)]";
    return "text-[var(--text-secondary)] bg-[var(--background)] border border-[var(--border-color)]";
  };

  const getPolicyStatusBadge = (status: string) => {
    if (status === "failed") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--danger-bg)] text-[var(--danger)]">
          <XCircle className="w-3 h-3 mr-1 text-[var(--danger)]" />
          Failed
        </span>
      );
    }
    if (status === "needs_review") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--warning-bg)] text-[var(--warning)]">
          <AlertTriangle className="w-3 h-3 mr-1 text-[var(--warning)]" />
          Needs Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-bg)] text-[var(--text-primary)]">
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto"></div>
            <p className="mt-4 text-[var(--text-muted)]">Loading pending reviews...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-[var(--primary)]" />
            AI Content Review
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            Review AI-generated content with policy violations
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{pendingReviews.length}</p>
                <p className="text-[var(--text-muted)] text-sm">Pending Reviews</p>
              </div>
            </div>
          </div>
        </div>

        {pendingReviews.length === 0 ? (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">All caught up!</h3>
            <p className="text-[var(--text-secondary)]">No pending AI-generated content to review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: List of pending reviews */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-2">
                Pending Reviews
              </h2>
              <div className="space-y-2">
                {pendingReviews.map((review) => (
                  <button
                    key={review.id}
                    onClick={() => setSelectedReview(review)}
                    className={`w-full text-left p-4 rounded-xl border transition-all card-hover ${
                      selectedReview?.id === review.id
                        ? "bg-[var(--primary-bg)] border-[var(--primary)]"
                        : "bg-[var(--card-bg)] border-[var(--border-color)]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--text-primary)] truncate">{review.title}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Product #{review.product_id}</p>
                      </div>
                      {getPolicyStatusBadge(review.policy_status)}
                    </div>
                    <div className="flex items-center text-xs text-[var(--text-muted)] space-x-2">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                      <span className="text-[var(--border-color)]">•</span>
                      <span className="capitalize">{review.provider}</span>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-[var(--danger)]">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {review.policy_flags?.violations?.length || 0} violation(s)
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Detail view */}
            <div className="lg:col-span-2">
              {selectedReview ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl">
                  <div className="border-b border-[var(--border-color)] p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                          {selectedReview.title}
                        </h2>
                        <div className="flex items-center space-x-4 text-sm text-[var(--text-muted)]">
                          <span>Product #{selectedReview.product_id}</span>
                          <span>•</span>
                          <span className="capitalize">{selectedReview.provider}</span>
                          <span>•</span>
                          <span>{new Date(selectedReview.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {getPolicyStatusBadge(selectedReview.policy_status)}
                    </div>
                  </div>

                  {/* Policy Violations */}
                  <div className="p-6 border-b border-[var(--border-color)] bg-[var(--background)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2 text-[var(--danger)]" />
                      Policy Violations ({selectedReview.policy_flags?.violations?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {selectedReview.policy_flags?.violations?.map((violation, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${getPolicySeverityColor(
                            violation.severity
                          )}`}
                        >
                          <div className="flex items-start">
                            <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-[var(--danger)]" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{violation.message}</p>
                              {violation.field && (
                                <p className="text-xs mt-1 opacity-75">
                                  Field: <span className="font-mono">{violation.field}</span>
                                </p>
                              )}
                              {violation.location && (
                                <p className="text-xs mt-1 opacity-75">
                                  Location: {violation.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Suggestions */}
                    {selectedReview.policy_flags?.suggestions &&
                      selectedReview.policy_flags.suggestions.length > 0 && (
                        <div className="mt-4 p-3 bg-[var(--info-bg)] rounded-lg border border-[var(--border-color)]">
                          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                            Suggestions
                          </h4>
                          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                            {selectedReview.policy_flags.suggestions.map((suggestion, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{suggestion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>

                  {/* Generated Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Title</h3>
                      <p className="text-[var(--text-primary)]">{selectedReview.title}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Description</h3>
                      <p className="text-[var(--text-primary)] whitespace-pre-wrap">
                        {selectedReview.description}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 flex items-center">
                        <Tag className="w-4 h-4 mr-1" />
                        Tags ({selectedReview.tags.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedReview.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-[var(--primary-bg)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-[var(--border-color)] p-6 bg-[var(--background)] flex items-center justify-between">
                    <button
                      onClick={() => handleReject(selectedReview.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 border border-[var(--danger)]/40 text-[var(--danger)] rounded-lg hover:bg-[var(--danger-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </button>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => openModifyModal(selectedReview)}
                        disabled={actionLoading}
                        className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Modify
                      </button>

                      <button
                        onClick={() => handleAccept(selectedReview.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Accept Anyway
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-10 text-center">
                  <Sparkles className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                    Select a review to get started
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    Choose an item from the list to review its AI-generated content and policy
                    violations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modify Modal */}
      {showModifyModal && selectedReview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--border-color)]">
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center">
                <Edit3 className="w-5 h-5 mr-2" />
                Modify Content
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Edit the content to fix policy violations. It will be re-checked automatically.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Title</label>
                <input
                  type="text"
                  value={modifyForm.title}
                  onChange={(e) => setModifyForm({ ...modifyForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  maxLength={140}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">{modifyForm.title.length}/140 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
                <textarea
                  value={modifyForm.description}
                  onChange={(e) => setModifyForm({ ...modifyForm, description: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  maxLength={1000}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {modifyForm.description.length}/1000 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={modifyForm.tags}
                  onChange={(e) => setModifyForm({ ...modifyForm, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  placeholder="handmade, ceramic, mug, coffee"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {modifyForm.tags.split(",").filter((t) => t.trim()).length} tags (max 13)
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--border-color)] bg-[var(--background)] flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowModifyModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--card-bg)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleModify}
                disabled={actionLoading}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save & Re-Check
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
