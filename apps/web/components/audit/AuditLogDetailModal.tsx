/**
 * Audit Log Detail Modal
 * Shows detailed information about a specific audit log entry
 */

import { X, Copy, CheckCircle, User, Clock, Activity, Database, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface AuditLog {
  id: number;
  request_id: string;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_ip: string | null;
  tenant_id: number | null;
  shop_id: number | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  http_method: string | null;
  http_path: string | null;
  http_status: number | null;
  status: string;
  error_message: string | null;
  request_metadata: any;
  response_metadata: any;
  attempt: number;
  latency_ms: number | null;
  created_at: string;
}

interface AuditLogDetailModalProps {
  log: AuditLog;
  onClose: () => void;
}

export function AuditLogDetailModal({ log, onClose }: AuditLogDetailModalProps) {
  const [copied, setCopied] = useState(false);
  
  const copyRequestId = () => {
    navigator.clipboard.writeText(log.request_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  const getStatusColor = (status: string) => {
    const colors = {
      success: 'text-green-600 bg-green-100',
      failure: 'text-yellow-600 bg-yellow-100',
      error: 'text-red-600 bg-red-100',
      pending: 'text-blue-600 bg-blue-100',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Audit Log Details</h3>
            <p className="text-sm text-gray-600 mt-1">Log ID: {log.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Status & Action */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(log.status)}`}>
                  {log.status.toUpperCase()}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action
                </label>
                <p className="text-gray-900 font-medium">{log.action}</p>
              </div>
            </div>

            {/* Request Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Activity className="w-5 h-5 text-blue-600 mr-2" />
                <h4 className="font-semibold text-blue-900">Request Information</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Request ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      {log.request_id}
                    </code>
                    <button
                      onClick={copyRequestId}
                      className="text-blue-600 hover:text-blue-800"
                      title="Copy Request ID"
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {log.http_method && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">HTTP Method:</span>
                    <span className="text-sm font-medium text-blue-900">{log.http_method}</span>
                  </div>
                )}
                {log.http_path && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">HTTP Path:</span>
                    <span className="text-xs font-mono text-blue-900">{log.http_path}</span>
                  </div>
                )}
                {log.http_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">HTTP Status:</span>
                    <span className={`text-sm font-medium ${log.http_status < 400 ? 'text-green-600' : 'text-red-600'}`}>
                      {log.http_status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actor Information */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <User className="w-5 h-5 text-purple-600 mr-2" />
                <h4 className="font-semibold text-purple-900">Actor Information</h4>
              </div>
              <div className="space-y-2">
                {log.actor_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700">Email:</span>
                    <span className="text-sm font-medium text-purple-900">{log.actor_email}</span>
                  </div>
                )}
                {log.actor_user_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700">User ID:</span>
                    <span className="text-sm font-medium text-purple-900">{log.actor_user_id}</span>
                  </div>
                )}
                {log.actor_ip && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700">IP Address:</span>
                    <span className="text-sm font-mono text-purple-900">{log.actor_ip}</span>
                  </div>
                )}
                {!log.actor_email && !log.actor_user_id && (
                  <p className="text-sm text-purple-700">System/Anonymous</p>
                )}
              </div>
            </div>

            {/* Target Information */}
            {(log.target_type || log.target_id) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Database className="w-5 h-5 text-green-600 mr-2" />
                  <h4 className="font-semibold text-green-900">Target Information</h4>
                </div>
                <div className="space-y-2">
                  {log.target_type && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Type:</span>
                      <span className="text-sm font-medium text-green-900">{log.target_type}</span>
                    </div>
                  )}
                  {log.target_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">ID:</span>
                      <span className="text-sm font-medium text-green-900">{log.target_id}</span>
                    </div>
                  )}
                  {log.shop_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Shop ID:</span>
                      <span className="text-sm font-medium text-green-900">{log.shop_id}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Performance Information */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                <h4 className="font-semibold text-yellow-900">Performance & Timing</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-yellow-700">Timestamp:</span>
                  <span className="text-sm font-medium text-yellow-900">{formatDate(log.created_at)}</span>
                </div>
                {log.latency_ms !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-yellow-700">Latency:</span>
                    <span className={`text-sm font-medium ${log.latency_ms > 1000 ? 'text-red-600' : 'text-green-600'}`}>
                      {log.latency_ms}ms
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-yellow-700">Attempt:</span>
                  <span className="text-sm font-medium text-yellow-900">{log.attempt}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {log.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <h4 className="font-semibold text-red-900">Error Details</h4>
                </div>
                <p className="text-sm text-red-800 font-mono bg-white p-3 rounded border border-red-200 whitespace-pre-wrap">
                  {log.error_message}
                </p>
              </div>
            )}

            {/* Request Metadata */}
            {log.request_metadata && Object.keys(log.request_metadata).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Request Metadata</h4>
                <pre className="text-xs font-mono bg-white p-3 rounded border border-gray-300 overflow-x-auto">
                  {JSON.stringify(log.request_metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Response Metadata */}
            {log.response_metadata && Object.keys(log.response_metadata).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Response Metadata</h4>
                <pre className="text-xs font-mono bg-white p-3 rounded border border-gray-300 overflow-x-auto">
                  {JSON.stringify(log.response_metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

