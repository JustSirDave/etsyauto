'use client';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { DollarSign, Loader2, ChevronDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';

export interface CurrencyTabProps {
  currencyPrefs: {
    preferredCurrency: string;
    onPreferredCurrencyChange: (code: string) => void;
    supportedCurrencies: string[];
    dropdownOpen: boolean;
    onDropdownOpenChange: (open: boolean) => void;
  };
  loading: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;
  toast?: unknown;
}

export function CurrencyTab({
  currencyPrefs,
  loading: loadingCurrency,
  saving: savingCurrency,
  onSave,
}: CurrencyTabProps) {
  const { t } = useLanguage();
  const {
    preferredCurrency,
    onPreferredCurrencyChange,
    supportedCurrencies,
    dropdownOpen: currencyDropdownOpen,
    onDropdownOpenChange: setCurrencyDropdownOpen,
  } = currencyPrefs;

  return (
    <div className="space-y-6">
      <DashboardCard>
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.currencyPreferences')}</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-6">{t('settings.currencyPreferencesDesc')}</p>
        {loadingCurrency ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('settings.preferredCurrency')}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                  onBlur={() => setTimeout(() => setCurrencyDropdownOpen(false), 150)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-left hover:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                >
                  <span className="font-medium">{preferredCurrency}</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-[var(--text-muted)] transition-transform',
                      currencyDropdownOpen && 'rotate-180'
                    )}
                  />
                </button>
                {currencyDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setCurrencyDropdownOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute left-0 right-0 mt-1 z-50 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {(supportedCurrencies.length ? supportedCurrencies : [
                        'USD',
                        'EUR',
                        'GBP',
                        'CAD',
                        'AUD',
                        'ILS',
                        'JPY',
                        'MXN',
                        'BRL',
                      ]).map((ccy) => (
                        <button
                          key={ccy}
                          type="button"
                          onClick={() => {
                            onPreferredCurrencyChange(ccy);
                            setCurrencyDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors',
                            preferredCurrency === ccy
                              ? 'bg-[var(--primary-bg)] text-[var(--primary)] font-medium'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]'
                          )}
                        >
                          {ccy}
                          {preferredCurrency === ccy && <CheckCircle className="w-4 h-4 text-[var(--primary)]" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex sm:pb-0.5">
              <button
                onClick={onSave}
                disabled={savingCurrency}
                className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium transition-colors"
              >
                {savingCurrency ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
