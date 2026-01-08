'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/basePath'

interface LinearUser {
  id: string
  name: string
  email: string
}

interface UserInfo {
  linearConfigured: boolean
  linearUser?: LinearUser
}

export default function SettingsPage() {
  const [linearToken, setLinearToken] = useState('')
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; user?: LinearUser } | null>(null)

  // 加载用户信息
  useEffect(() => {
    async function loadUserInfo() {
      try {
        const res = await apiFetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUserInfo({
            linearConfigured: !!data.user?.linearToken,
            linearUser: data.linearUser,
          })
        }
      } catch (error) {
        console.error('Failed to load user info:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUserInfo()
  }, [])

  // 验证 API Key
  const handleValidate = async () => {
    if (!linearToken.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API Key' })
      return
    }

    setValidating(true)
    setMessage(null)
    setValidationResult(null)

    try {
      const res = await apiFetch('/api/linear/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: linearToken }),
      })

      const data = await res.json()

      if (data.valid) {
        setValidationResult({ valid: true, user: data.user })
        setMessage({ type: 'success', text: 'API Key is valid!' })
      } else {
        setValidationResult({ valid: false })
        setMessage({ type: 'error', text: 'Invalid API Key' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to validate API Key' })
    } finally {
      setValidating(false)
    }
  }

  // 保存 API Key
  const handleSave = async () => {
    if (!validationResult?.valid) {
      setMessage({ type: 'error', text: 'Please validate the API Key first' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await apiFetch('/api/user/linear-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linearToken }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'Linear API Key saved successfully!' })
        setUserInfo({
          linearConfigured: true,
          linearUser: data.linearUser,
        })
        setLinearToken('')
        setValidationResult(null)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API Key' })
    } finally {
      setSaving(false)
    }
  }

  // 删除 API Key
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove the Linear API Key?')) {
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await apiFetch('/api/user/linear-token', {
        method: 'DELETE',
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Linear API Key removed' })
        setUserInfo({
          linearConfigured: false,
          linearUser: undefined,
        })
      } else {
        setMessage({ type: 'error', text: 'Failed to remove API Key' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove API Key' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6">
        {/* Linear Integration Section */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.293 3.293a1 1 0 011.414 0L12 10.586l7.293-7.293a1 1 0 111.414 1.414l-8 8a1 1 0 01-1.414 0l-8-8a1 1 0 010-1.414z" />
            </svg>
            Linear Integration
          </h2>

          {/* Current Status */}
          {userInfo?.linearConfigured ? (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Connected</span>
              </div>
              {userInfo.linearUser && (
                <p className="text-gray-300 text-sm">
                  Linked to: {userInfo.linearUser.name} ({userInfo.linearUser.email})
                </p>
              )}
              <button
                onClick={handleDelete}
                disabled={saving}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm"
              >
                {saving ? 'Removing...' : 'Remove Connection'}
              </button>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">Not Connected</span>
              </div>
              <p className="text-gray-400 text-sm">
                Connect your Linear account to publish tasks directly to Linear.
              </p>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Linear API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={linearToken}
                  onChange={(e) => {
                    setLinearToken(e.target.value)
                    setValidationResult(null)
                    setMessage(null)
                  }}
                  placeholder="lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleValidate}
                  disabled={validating || !linearToken.trim()}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                >
                  {validating ? 'Validating...' : 'Validate'}
                </button>
              </div>
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div className={`p-3 rounded-lg ${validationResult.valid ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                {validationResult.valid ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Valid - {validationResult.user?.name} ({validationResult.user?.email})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Invalid API Key</span>
                  </div>
                )}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving || !validationResult?.valid}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              {saving ? 'Saving...' : 'Save API Key'}
            </button>

            {/* Message */}
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {message.text}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-700/30 rounded-lg">
            <h3 className="font-medium text-gray-300 mb-2">How to get your API Key:</h3>
            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Linear Settings → API</a></li>
              <li>Click &quot;Personal API Keys&quot;</li>
              <li>Click &quot;Create key&quot; and enter a name like &quot;Seeder&quot;</li>
              <li>Copy the generated key and paste it above</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  )
}
