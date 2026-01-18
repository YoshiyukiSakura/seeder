/**
 * Utility functions for conversation data conversion
 */

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  imagePaths?: string[]
}

interface DBConversation {
  id: string
  role: string
  content: string
  createdAt: string
  metadata?: unknown
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
    imagePaths: metadata?.imagePaths
  }
}
