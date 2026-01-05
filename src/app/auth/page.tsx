'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const errorMessages: Record<string, string> = {
  missing_token: 'Login link is missing or invalid.',
  invalid_token: 'Login link is invalid or has already been used.',
  token_used: 'This login link has already been used.',
  token_expired: 'Login link has expired. Please request a new one.',
  server_error: 'An error occurred. Please try again.',
}

function AuthContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = searchParams.get('token')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setError(errorMessages[errorParam] || 'An error occurred.')
      setLoading(false)
      return
    }

    if (token) {
      // 有 token，重定向到验证 API
      window.location.href = `/api/auth/slack?token=${token}`
    } else {
      // 无 token，显示使用说明
      setLoading(false)
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Logging in...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Seedbed Login
        </h1>

        {error ? (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        ) : null}

        <div className="text-gray-300 space-y-4">
          <p>To log in to Seedbed, use the Slack command:</p>
          <code className="block bg-gray-900 p-3 rounded text-green-400">
            /seedbed-login
          </code>
          <p className="text-sm text-gray-500">
            This will send you a private message with a login link that expires
            in 5 minutes.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-gray-500 text-sm text-center">
            Don&apos;t have access? Contact your workspace administrator.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-lg">Loading...</div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
