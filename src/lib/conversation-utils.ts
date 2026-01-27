/**
 * Utility functions for conversation data conversion
 */

export interface MessageUser {
  id: string
  slackUsername: string
  avatarUrl: string | null
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  imagePaths?: string[]
  user?: MessageUser
}

interface DBConversation {
  id: string
  role: string
  content: string
  createdAt: string
  metadata?: unknown
  user?: {
    id: string
    slackUsername: string
    avatarUrl: string | null
  } | null
}

interface ConversationMetadata {
  imagePaths?: string[]
}

/**
 * Convert a database Conversation record to frontend Message format
 */
export function convertConversationToMessage(conv: DBConversation): Message {
  const metadata = conv.metadata as ConversationMetadata | undefined
  return {
    id: conv.id,
    role: conv.role as 'user' | 'assistant' | 'system',
    content: conv.content,
    timestamp: new Date(conv.createdAt),
    imagePaths: metadata?.imagePaths,
    user: conv.user ? {
      id: conv.user.id,
      slackUsername: conv.user.slackUsername,
      avatarUrl: conv.user.avatarUrl
    } : undefined
  }
}
