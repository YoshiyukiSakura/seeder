/**
 * Utility functions for conversation data conversion
 */

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface DBConversation {
  id: string
  role: string
  content: string
  createdAt: string
  metadata?: unknown
}

/**
 * Convert a database Conversation record to frontend Message format
 */
export function convertConversationToMessage(conv: DBConversation): Message {
  return {
    id: conv.id,
    role: conv.role as 'user' | 'assistant' | 'system',
    content: conv.content,
    timestamp: new Date(conv.createdAt)
  }
}
