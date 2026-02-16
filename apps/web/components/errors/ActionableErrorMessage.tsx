'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, Info, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface ErrorAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
}

interface ActionableErrorMessageProps {
  errorCode: string;
  errorMessage?: string;
  context?: {
    jobId?: number;
    listingId?: string;
    productId?: number;
    shopId?: number;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

interface ErrorConfig {
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  icon: React.ComponentType<{ className?: string }>;
  actions: ErrorAction[];
  documentation?: string;
}

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
  // Authentication Errors
  'ETSY_401': {
    title: 'Etsy Connection Expired',
    description: 'Your Etsy shop connection has expired. Please reconnect your shop to continue publishing listings.',
    severity: 'error',
    icon: XCircle,
    actions: [
      { label: 'Reconnect Shop', href: '/settings?tab=shops', variant: 'primary' },
      { label: 'Learn More', href: '/docs/authentication', variant: 'secondary' }
    ],
    documentation: '/docs/authentication#token-expiry'
  },
  
  'ETSY_403': {
    title: 'Permission Denied',
    description: 'You don\'t have permission to perform this action. Check your Etsy app permissions.',
    severity: 'error',
    icon: XCircle,
    actions: [
      { label: 'Review Permissions', href: 'https://www.etsy.com/your/account/apps', variant: 'primary' },
      { label: 'Contact Support', href: '/support', variant: 'secondary' }
    ]
  },

  // Rate Limiting
  'ETSY_429': {
    title: 'Rate Limit Reached',
    description: 'Etsy API rate limit exceeded. Your job will automatically retry in a few minutes.',
    severity: 'warning',
    icon: AlertTriangle,
    actions: [
      { label: 'View Rate Limits', href: '/docs/rate-limits', variant: 'secondary' }
    ],
    documentation: '/docs/rate-limits'
  },

  'RATE_LIMIT_429_STORM': {
    title: 'Rate Limit Storm Detected',
    description: 'Multiple rate limit errors detected. Consider spreading out your publishing schedule.',
    severity: 'warning',
    icon: AlertTriangle,
    actions: [
      { label: 'Adjust Schedule', href: '/schedules', variant: 'primary' },
      { label: 'View Guidelines', href: '/docs/best-practices', variant: 'secondary' }
    ]
  },

  // Policy Violations
  'POLICY_BLOCKED': {
    title: 'Policy Violation',
    description: 'This listing violates one or more policies and cannot be published until fixed.',
    severity: 'error',
    icon: AlertCircle,
    actions: [
      { label: 'Review & Fix', variant: 'primary' },
      { label: 'View Policies', href: '/docs/policies', variant: 'secondary' }
    ],
    documentation: '/docs/policies'
  },

  'PROHIBITED_TERMS': {
    title: 'Prohibited Terms Detected',
    description: 'Your listing contains prohibited terms or phrases. Edit the content to comply with policies.',
    severity: 'error',
    icon: AlertCircle,
    actions: [
      { label: 'Edit Listing', variant: 'primary' },
      { label: 'View Prohibited Terms', href: '/docs/prohibited-terms', variant: 'secondary' }
    ]
  },

  'HANDMADE_REQUIRED': {
    title: 'Handmade Declaration Missing',
    description: 'This listing must declare who made it. Update the "who_made" field.',
    severity: 'error',
    icon: AlertCircle,
    actions: [
      { label: 'Update Product', variant: 'primary' }
    ]
  },

  // Resource Not Found
  'ETSY_404': {
    title: 'Listing Not Found',
    description: 'This listing was not found on Etsy. It may have been deleted or the ID is incorrect.',
    severity: 'warning',
    icon: Info,
    actions: [
      { label: 'Republish', variant: 'primary' },
      { label: 'View on Etsy', href: '#', variant: 'secondary' }
    ]
  },

  'LISTING_DELETED': {
    title: 'Listing Deleted on Etsy',
    description: 'This listing has been deleted on Etsy and can no longer be synced.',
    severity: 'info',
    icon: Info,
    actions: [
      { label: 'Create New Listing', variant: 'primary' }
    ]
  },

  // Listing State Errors
  'LISTING_EXPIRED': {
    title: 'Listing Expired',
    description: 'This listing has expired on Etsy. You can renew it to make it active again.',
    severity: 'warning',
    icon: AlertTriangle,
    actions: [
      { label: 'Renew Listing', variant: 'primary' },
      { label: 'Learn About Renewals', href: '/docs/listing-management', variant: 'secondary' }
    ]
  },

  'ETSY_STATE_INACTIVE': {
    title: 'Listing Deactivated',
    description: 'This listing is inactive on Etsy. Reactivate it to continue selling.',
    severity: 'warning',
    icon: AlertTriangle,
    actions: [
      { label: 'Reactivate', variant: 'primary' }
    ]
  },

  'ETSY_STATE_SOLD_OUT': {
    title: 'Listing Sold Out',
    description: 'This listing is sold out. Update the quantity to continue selling.',
    severity: 'info',
    icon: Info,
    actions: [
      { label: 'Update Quantity', variant: 'primary' }
    ]
  },

  // Image Errors
  'IMAGE_TOO_LARGE': {
    title: 'Image Too Large',
    description: 'One or more images exceed the 10MB size limit. Compress your images and try again.',
    severity: 'error',
    icon: XCircle,
    actions: [
      { label: 'Upload New Images', variant: 'primary' },
      { label: 'Image Guidelines', href: '/docs/images', variant: 'secondary' }
    ],
    documentation: '/docs/images#size-limits'
  },

  'IMAGE_UPLOAD_FAILED': {
    title: 'Image Upload Failed',
    description: 'Some images failed to upload. The listing was created but without all images.',
    severity: 'warning',
    icon: AlertTriangle,
    actions: [
      { label: 'Retry Upload', variant: 'primary' }
    ]
  },

  // RBAC Errors
  'RBAC_DENIED': {
    title: 'Access Denied',
    description: 'You don\'t have permission to perform this action. Contact your account owner.',
    severity: 'error',
    icon: XCircle,
    actions: [
      { label: 'View Permissions', href: '/team', variant: 'secondary' }
    ]
  },

  // Server Errors
  'ETSY_500': {
    title: 'Etsy Server Error',
    description: 'Etsy is experiencing technical difficulties. Your job will automatically retry.',
    severity: 'warning',
    icon: AlertTriangle,
    actions: [
      { label: 'Check Etsy Status', href: 'https://status.etsy.com', variant: 'secondary' }
    ]
  },

  'INTERNAL_ERROR': {
    title: 'Internal Error',
    description: 'An unexpected error occurred. Our team has been notified.',
    severity: 'error',
    icon: XCircle,
    actions: [
      { label: 'Retry', variant: 'primary' },
      { label: 'Contact Support', href: '/support', variant: 'secondary' }
    ]
  },

  // Taxonomy/Category Errors
  'INVALID_TAXONOMY': {
    title: 'Invalid Category',
    description: 'The selected category is not valid for Etsy. Choose a different category.',
    severity: 'error',
    icon: AlertCircle,
    actions: [
      { label: 'Update Category', variant: 'primary' },
      { label: 'Browse Categories', href: '/docs/categories', variant: 'secondary' }
    ]
  },

  // Shipping Errors
  'MISSING_SHIPPING_PROFILE': {
    title: 'Shipping Profile Missing',
    description: 'No shipping profile is configured. Set up shipping in your Etsy shop settings.',
    severity: 'error',
    icon: XCircle,
    actions: [
      { label: 'Configure Shipping', href: '/shops', variant: 'primary' },
      { label: 'Etsy Shipping Guide', href: 'https://help.etsy.com/hc/en-us/articles/115015672808', variant: 'secondary' }
    ]
  },

  // Default fallback
  'UNKNOWN': {
    title: 'Error Occurred',
    description: 'An error occurred while processing your request.',
    severity: 'error',
    icon: AlertCircle,
    actions: [
      { label: 'Retry', variant: 'primary' }
    ]
  }
};

const ActionableErrorMessage: React.FC<ActionableErrorMessageProps> = ({
  errorCode,
  errorMessage,
  context,
  onRetry,
  onDismiss,
  compact = false
}) => {
  const config = ERROR_CONFIGS[errorCode] || ERROR_CONFIGS['UNKNOWN'];
  const Icon = config.icon;

  const getSeverityStyles = () => {
    switch (config.severity) {
      case 'error':
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-600',
          title: 'text-red-900',
          description: 'text-red-700'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-600',
          title: 'text-yellow-900',
          description: 'text-yellow-700'
        };
      case 'info':
        return {
          container: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          description: 'text-blue-700'
        };
    }
  };

  const styles = getSeverityStyles();

  const handleAction = (action: ErrorAction) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.label === 'Retry' && onRetry) {
      onRetry();
    } else if (action.label === 'Review & Fix' && context?.productId) {
      window.location.href = `/products/${context.productId}`;
    } else if (action.label === 'Edit Listing' && context?.productId) {
      window.location.href = `/products/${context.productId}/edit`;
    } else if (action.label === 'Update Product' && context?.productId) {
      window.location.href = `/products/${context.productId}`;
    } else if (action.label === 'Reconnect Shop') {
      window.location.href = '/settings?tab=shops';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded border ${styles.container}`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${styles.icon}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${styles.title}`}>{config.title}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-shrink-0 text-sm font-medium hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${styles.container}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${styles.icon}`} />
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className={`text-sm font-semibold ${styles.title}`}>
                {config.title}
              </h3>
              <p className={`mt-1 text-sm ${styles.description}`}>
                {errorMessage || config.description}
              </p>
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error Code & Context */}
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>Code: {errorCode}</span>
            {context?.jobId && <span>Job: #{context.jobId}</span>}
            {context?.listingId && <span>Listing: {context.listingId}</span>}
          </div>

          {/* Actions */}
          {config.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {config.actions.map((action, idx) => {
                const isPrimary = action.variant === 'primary';
                
                if (action.href) {
                  return (
                    <a
                      key={idx}
                      href={action.href}
                      target={action.href.startsWith('http') ? '_blank' : undefined}
                      rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                        isPrimary
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {action.label}
                      {action.href.startsWith('http') && (
                        <ExternalLink className="w-3 h-3" />
                      )}
                    </a>
                  );
                }
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleAction(action)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                      isPrimary
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {action.label === 'Retry' && <RefreshCw className="w-3 h-3" />}
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Documentation Link */}
          {config.documentation && (
            <div className="mt-3 text-xs">
              <a
                href={config.documentation}
                className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                View documentation
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionableErrorMessage;

