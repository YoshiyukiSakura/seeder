'use client'

import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'blue' | 'white' | 'gray' | 'green'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-4',
  xl: 'h-12 w-12 border-4',
}

const colorClasses = {
  blue: 'border-blue-500 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
  green: 'border-green-500 border-t-transparent',
}

export function LoadingSpinner({
  size = 'md',
  color = 'blue',
  className = '',
  label,
}: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && <span className="text-gray-400 text-sm">{label}</span>}
    </div>
  )
}

// Full page loading overlay
interface LoadingOverlayProps {
  label?: string
  show?: boolean
}

export function LoadingOverlay({ label = 'Loading...', show = true }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
        <LoadingSpinner size="lg" label={label} />
      </div>
    </div>
  )
}

// Inline loading indicator for buttons or inline text
interface InlineLoadingProps {
  size?: 'sm' | 'md'
  className?: string
}

export function InlineLoading({ size = 'sm', className = '' }: InlineLoadingProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LoadingSpinner size={size} />
    </span>
  )
}

// Loading state wrapper component
interface LoadingStateProps {
  loading: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
  label?: string
}

export function LoadingState({
  loading,
  children,
  fallback,
  label = 'Loading...',
}: LoadingStateProps) {
  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" label={label} />
        </div>
      )
    )
  }

  return <>{children}</>
}

export default LoadingSpinner
