'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/basePath'

interface UserInfo {
  username: string
  email?: string
}

export default function SettingsPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserInfo() {
      try {
        const res = await apiFetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUserInfo({
            username: data.user?.slackUsername || 'Unknown',
            email: data.user?.email,
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
        {/* User Info Section */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>

          {userInfo && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                <p className="text-white">{userInfo.username}</p>
              </div>
              {userInfo.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <p className="text-white">{userInfo.email}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
