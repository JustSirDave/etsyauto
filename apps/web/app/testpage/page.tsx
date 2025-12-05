/**
 * TEST PAGE - Deployment Verification
 * Created: 2025-12-05 17:50 UTC
 * Purpose: Verify that code changes are successfully deploying to production
 */

export default function TestPage() {
  const buildInfo = {
    version: '2.0.5',
    timestamp: '2025-12-05 17:50:00 UTC',
    environment: process.env.NODE_ENV || 'development',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'not set',
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? 'configured' : 'not configured',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🚀 Deployment Test Page
          </h1>
          <p className="text-gray-600">
            If you see this page, the deployment is working!
          </p>
        </div>

        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">✅</span>
            <h2 className="text-2xl font-bold text-green-800">
              Success!
            </h2>
          </div>
          <p className="text-green-700 text-lg">
            This page was created on December 5th, 2025 at 17:50 UTC.
            If you're seeing this, your git pull and container rebuild worked correctly!
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 space-y-3">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Build Information:</h3>

          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-semibold text-gray-700">Version:</span>
            <span className="text-gray-600">{buildInfo.version}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-semibold text-gray-700">Build Time:</span>
            <span className="text-gray-600">{buildInfo.timestamp}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-semibold text-gray-700">Environment:</span>
            <span className="text-gray-600 font-mono">{buildInfo.environment}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="font-semibold text-gray-700">API URL:</span>
            <span className="text-gray-600 font-mono">
              {buildInfo.apiUrl === '' ? '(empty - using relative URLs)' : buildInfo.apiUrl}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span className="font-semibold text-gray-700">Google OAuth:</span>
            <span className={`font-mono ${buildInfo.googleClientId === 'configured' ? 'text-green-600' : 'text-red-600'}`}>
              {buildInfo.googleClientId}
            </span>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <a
            href="/"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition"
          >
            Back to Home
          </a>
          <a
            href="/login"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition"
          >
            Go to Login
          </a>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Navigate to: <code className="bg-gray-200 px-2 py-1 rounded">/testpage</code></p>
        </div>
      </div>
    </div>
  );
}
