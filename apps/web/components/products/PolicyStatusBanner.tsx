/**
 * Policy Status Banner
 * Shows policy compliance status and violations with remediation option
 */

import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface PolicyCheck {
  compliant: boolean;
  policy_status: string;
  policy_flags: string[];
  can_publish: boolean;
  remediation_required: boolean;
  checks: any;
}

interface PolicyStatusBannerProps {
  policyCheck: PolicyCheck | null;
  onRemediate: () => void;
  onRecheck: () => void;
  loading?: boolean;
}

export function PolicyStatusBanner({ policyCheck, onRemediate, onRecheck, loading }: PolicyStatusBannerProps) {
  if (!policyCheck) return null;
  
  const getStatusConfig = () => {
    switch (policyCheck.policy_status) {
      case 'passed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600',
          title: '✓ Policy Compliant',
          message: 'This product meets all Etsy policy requirements and can be published.',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: AlertTriangle,
          iconColor: 'text-yellow-600',
          title: '⚠ Policy Warnings',
          message: 'This product has minor policy warnings but can still be published.',
        };
      case 'failed':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: XCircle,
          iconColor: 'text-red-600',
          title: '✗ Policy Violations',
          message: 'This product has policy violations and CANNOT be published until fixed.',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: RefreshCw,
          iconColor: 'text-gray-600',
          title: 'Policy Check Pending',
          message: 'Run a policy check before publishing.',
        };
    }
  };
  
  const config = getStatusConfig();
  const Icon = config.icon;
  
  return (
    <div className={`rounded-lg border-2 ${config.border} ${config.bg} p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <Icon className={`w-6 h-6 ${config.iconColor} mt-0.5`} />
          <div className="flex-1">
            <h4 className={`font-semibold ${config.text}`}>{config.title}</h4>
            <p className={`text-sm ${config.text} mt-1`}>{config.message}</p>
            
            {/* Policy Violations */}
            {policyCheck.policy_flags && policyCheck.policy_flags.length > 0 && (
              <div className="mt-3">
                <p className={`text-xs font-semibold ${config.text} mb-2`}>Issues Found:</p>
                <ul className="space-y-1">
                  {policyCheck.policy_flags.map((flag, index) => (
                    <li key={index} className={`text-xs ${config.text} flex items-center`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current mr-2"></span>
                      {formatPolicyFlag(flag)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Policy Check Details */}
            {policyCheck.checks && Object.keys(policyCheck.checks).length > 0 && (
              <details className="mt-3">
                <summary className={`text-xs font-semibold ${config.text} cursor-pointer hover:underline`}>
                  View Detailed Check Results
                </summary>
                <div className="mt-2 space-y-2">
                  {Object.entries(policyCheck.checks).map(([checkName, checkResult]: [string, any]) => (
                    <div key={checkName} className="text-xs">
                      <span className="font-semibold capitalize">{checkName}:</span>{' '}
                      <span className={checkResult.severity === 'critical' ? 'text-red-600' : checkResult.severity === 'warning' ? 'text-yellow-600' : 'text-green-600'}>
                        {checkResult.message}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-2 ml-4">
          {policyCheck.remediation_required && (
            <button
              onClick={onRemediate}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              Fix Issues
            </button>
          )}
          <button
            onClick={onRecheck}
            disabled={loading}
            className="px-4 py-2 bg-white border-2 border-current rounded-lg hover:bg-opacity-10 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Re-check
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPolicyFlag(flag: string): string {
  // Convert snake_case to Title Case
  return flag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

