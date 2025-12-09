'use client';

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  autoClose?: boolean;
  autoCloseDuration?: number;
}

export function NotificationModal({
  isOpen,
  onClose,
  title,
  message,
  type,
  autoClose = true,
  autoCloseDuration = 3000
}: NotificationModalProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDuration, onClose]);

  if (!isOpen) return null;

  const typeConfig = {
    success: {
      icon: CheckCircle,
      iconColor: 'text-[var(--success)]',
      bgColor: 'bg-[var(--success-bg)]',
      borderColor: 'border-[var(--success)]/30',
      title: 'Success!'
    },
    error: {
      icon: XCircle,
      iconColor: 'text-[var(--danger)]',
      bgColor: 'bg-[var(--danger-bg)]',
      borderColor: 'border-[var(--danger)]/30',
      title: 'Error'
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-[var(--warning)]',
      bgColor: 'bg-[var(--warning-bg)]',
      borderColor: 'border-[var(--warning)]/30',
      title: 'Warning'
    },
    info: {
      icon: Info,
      iconColor: 'text-[var(--info)]',
      bgColor: 'bg-[var(--info-bg)]',
      borderColor: 'border-[var(--info)]/30',
      title: 'Info'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-[var(--card-bg)] border ${config.borderColor} rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200`}>
        {/* Header */}
        <div className="flex items-start gap-4 p-6">
          <div className={`w-12 h-12 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              {title || config.title}
            </h3>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar for auto-close */}
        {autoClose && (
          <div className="h-1 bg-[var(--background)] overflow-hidden">
            <div 
              className={`h-full ${config.bgColor} transition-all ease-linear`}
              style={{ 
                animation: `shrink ${autoCloseDuration}ms linear forwards`,
                width: '100%'
              }}
            />
          </div>
        )}

        <style jsx>{`
          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  );
}

