'use client';

import { useToast } from '@/lib/toast-context';

export default function TestToastPage() {
  const { showToast } = useToast();

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-8">Toast Notification Test</h1>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => showToast('This is a success message!', 'success')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
          >
            Success Toast
          </button>

          <button
            onClick={() => showToast('This is an error message!', 'error')}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
          >
            Error Toast
          </button>

          <button
            onClick={() => showToast('This is a warning message!', 'warning')}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
          >
            Warning Toast
          </button>

          <button
            onClick={() => showToast('This is an info message!', 'info')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Info Toast
          </button>
        </div>

        <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-slate-300">
            Click any button above to test the toast notifications. They should appear in the top-right corner.
          </p>
        </div>
      </div>
    </div>
  );
}

