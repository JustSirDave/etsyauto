/**
 * AI Error Modal
 * Displays detailed AI generation errors with actionable steps
 */

import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { AIErrorDetails } from '@/lib/ai-error-handler';

interface AIErrorModalProps {
  error: AIErrorDetails;
  onClose: () => void;
}

export function AIErrorModal({ error, onClose }: AIErrorModalProps) {
  const severityColors = {
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const severityTextColors = {
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800',
  };

  const severityIconColors = {
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className={`p-4 border-b rounded-t-lg ${severityColors[error.severity]}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <AlertTriangle className={`w-6 h-6 mr-3 ${severityIconColors[error.severity]}`} />
              <h3 className={`text-lg font-semibold ${severityTextColors[error.severity]}`}>
                {error.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 mb-4 leading-relaxed">{error.message}</p>

          {error.action && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">✅ Next Step:</p>
              <p className="text-sm text-gray-600">{error.action}</p>
            </div>
          )}

          {error.actionUrl && (
            <a
              href={error.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Open in new tab
              <ExternalLink className="w-4 h-4 ml-1" />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

