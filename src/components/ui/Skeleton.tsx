'use client'

import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-700'

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  )
}

// TaskCard Skeleton - 模拟任务卡片的加载状态
export function TaskCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header: Priority badge + Title */}
      <div className="flex items-start gap-2 mb-3">
        <Skeleton width={32} height={20} className="rounded" />
        <Skeleton height={20} className="flex-1" />
      </div>

      {/* Description */}
      <div className="space-y-2 mb-3">
        <Skeleton height={14} className="w-full" />
        <Skeleton height={14} className="w-3/4" />
      </div>

      {/* Labels */}
      <div className="flex gap-2 mb-3">
        <Skeleton width={60} height={22} className="rounded-full" />
        <Skeleton width={50} height={22} className="rounded-full" />
      </div>

      {/* Footer: Estimate */}
      <div className="flex justify-between items-center">
        <Skeleton width={80} height={16} />
        <Skeleton width={40} height={16} />
      </div>
    </div>
  )
}

// TaskList Skeleton - 多个任务卡片的加载状态
interface TaskListSkeletonProps {
  count?: number
}

export function TaskListSkeleton({ count = 3 }: TaskListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <TaskCardSkeleton key={index} />
      ))}
    </div>
  )
}

// Project Selector Item Skeleton
export function ProjectItemSkeleton() {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1">
        <Skeleton height={16} className="w-32 mb-2" />
        <Skeleton height={12} className="w-48" />
      </div>
    </div>
  )
}

// Chat Message Skeleton
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'bg-blue-600' : 'bg-gray-700'} rounded-lg p-4`}>
        <div className="space-y-2">
          <Skeleton height={14} className="w-64" animation="pulse" />
          <Skeleton height={14} className="w-48" animation="pulse" />
          <Skeleton height={14} className="w-56" animation="pulse" />
        </div>
      </div>
    </div>
  )
}

export default Skeleton
