/**
 * AI Error Handler
 * Provides user-friendly error messages for AI generation failures
 */

export interface AIErrorDetails {
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
  severity: 'error' | 'warning' | 'info';
}

export function parseAIError(error: any): AIErrorDetails {
  const errorDetail = error?.detail || error?.message || JSON.stringify(error);
  const errorString = typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail);
  
  // Check for specific error patterns
  
  // 1. OpenAI Quota Exceeded
  if (errorString.includes('insufficient_quota') || errorString.includes('exceeded your current quota')) {
    return {
      title: '💳 OpenAI Credits Exhausted',
      message: 'Your OpenAI account has run out of credits. AI generation cannot proceed without available credits.',
      action: 'Add credits to your OpenAI account',
      actionUrl: 'https://platform.openai.com/account/billing',
      severity: 'error'
    };
  }
  
  // 2. Rate Limit Exceeded
  if (errorString.includes('rate_limit_exceeded') || errorString.includes('429')) {
    return {
      title: '⏱️ Too Many Requests',
      message: 'You\'ve made too many AI generation requests. Please wait a moment before trying again.',
      action: 'Wait 60 seconds and try again',
      severity: 'warning'
    };
  }
  
  // 3. Invalid API Key
  if (errorString.includes('invalid_api_key') || errorString.includes('incorrect API key') || errorString.includes('401')) {
    return {
      title: '🔑 Invalid API Key',
      message: 'The OpenAI API key is invalid or has been revoked. Please contact your administrator.',
      action: 'Update API key in settings',
      severity: 'error'
    };
  }
  
  // 4. OpenAI Service Unavailable
  if (errorString.includes('503') || errorString.includes('service_unavailable') || errorString.includes('overloaded')) {
    return {
      title: '🌐 OpenAI Service Unavailable',
      message: 'OpenAI\'s servers are currently experiencing high load. This is temporary.',
      action: 'Try again in a few minutes',
      actionUrl: 'https://status.openai.com',
      severity: 'warning'
    };
  }
  
  // 5. Network/Connection Error
  if (errorString.includes('network') || errorString.includes('fetch') || errorString.includes('connection')) {
    return {
      title: '📡 Connection Error',
      message: 'Unable to connect to the AI service. Please check your internet connection.',
      action: 'Check your connection and try again',
      severity: 'warning'
    };
  }
  
  // 6. Content Policy Violation (OpenAI)
  if (errorString.includes('content_policy') || errorString.includes('policy violation')) {
    return {
      title: '⚠️ Content Policy Issue',
      message: 'The product content violates OpenAI\'s usage policies. Please review your product information.',
      action: 'Update product details and try again',
      severity: 'warning'
    };
  }
  
  // 7. Timeout
  if (errorString.includes('timeout') || errorString.includes('timed out')) {
    return {
      title: '⏰ Request Timeout',
      message: 'The AI generation took too long to complete. This can happen with complex products.',
      action: 'Try again or simplify product details',
      severity: 'warning'
    };
  }
  
  // 8. Model Not Found / Unavailable
  if (errorString.includes('model_not_found') || errorString.includes('model not available')) {
    return {
      title: '🤖 AI Model Unavailable',
      message: 'The requested AI model is not available. Using a different model.',
      action: 'The system will use the default model',
      severity: 'info'
    };
  }
  
  // 9. Token Limit Exceeded
  if (errorString.includes('context_length_exceeded') || errorString.includes('maximum context length')) {
    return {
      title: '📝 Content Too Long',
      message: 'Your product information is too long for the AI to process.',
      action: 'Shorten the product description and try again',
      severity: 'error'
    };
  }
  
  // 10. Authentication/Permission Error
  if (errorString.includes('403') || errorString.includes('permission') || errorString.includes('forbidden')) {
    return {
      title: '🔒 Permission Denied',
      message: 'You don\'t have permission to generate AI content. Contact your administrator.',
      action: 'Check your account permissions',
      severity: 'error'
    };
  }
  
  // 11. Product Not Found
  if (errorString.includes('404') || errorString.includes('not found')) {
    return {
      title: '🔍 Product Not Found',
      message: 'The selected product could not be found. It may have been deleted.',
      action: 'Select a different product',
      severity: 'error'
    };
  }
  
  // 12. Generic OpenAI Error
  if (errorString.includes('OpenAI')) {
    return {
      title: '❌ OpenAI Error',
      message: errorString.substring(0, 200), // First 200 chars
      action: 'Contact support if this persists',
      severity: 'error'
    };
  }
  
  // Default: Generic Error
  return {
    title: '❌ Generation Failed',
    message: 'An unexpected error occurred while generating AI content.',
    action: 'Please try again or contact support',
    severity: 'error'
  };
}

/**
 * Format error message for display
 */
export function formatAIErrorMessage(errorDetails: AIErrorDetails): string {
  let message = `${errorDetails.title}\n\n${errorDetails.message}`;
  
  if (errorDetails.action) {
    message += `\n\n✅ Next Step: ${errorDetails.action}`;
  }
  
  return message;
}

/**
 * Get error color based on severity
 */
export function getErrorColor(severity: AIErrorDetails['severity']): string {
  switch (severity) {
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    case 'info':
      return 'blue';
    default:
      return 'red';
  }
}

