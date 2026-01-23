import { NextRequest, NextResponse } from 'next/server'
import { getMiniMaxClient } from '@/lib/minimax'
import { buildProjectExtractionPrompt, type ExtractedProjectInfo } from '@/lib/prompts/project-extraction'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationContent } = body

    if (!conversationContent) {
      return NextResponse.json(
        { error: 'conversationContent is required' },
        { status: 400 }
      )
    }

    const prompt = buildProjectExtractionPrompt(conversationContent)
    console.log('Extracting project info from conversation...')
    console.log('Conversation content length:', conversationContent.length)

    // Use MiniMax for project info extraction
    const minimaxClient = getMiniMaxClient()
    console.log('Using MiniMax for project extraction...')
    const response = await minimaxClient.generateContent(prompt)

    // Parse JSON response
    console.log('AI response length:', response.length)
    console.log('AI response preview:', response.slice(0, 300))

    let extractedInfo: ExtractedProjectInfo
    try {
      let jsonStr = response.trim()

      // Remove MiniMax model's <think>...</think> tags
      jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      // Remove markdown code block if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()

      console.log('JSON string to parse:', jsonStr.slice(0, 500))
      extractedInfo = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', response)
      // Return empty defaults on parse error
      extractedInfo = {
        suggestedName: '',
        displayName: '',
        description: '',
        techStack: [],
        conventions: {},
        keyFeatures: []
      }
    }

    // Validate and sanitize the extracted info
    const result: ExtractedProjectInfo = {
      suggestedName: sanitizeName(extractedInfo.suggestedName || ''),
      displayName: extractedInfo.displayName || '',
      description: extractedInfo.description || '',
      techStack: Array.isArray(extractedInfo.techStack) ? extractedInfo.techStack : [],
      conventions: extractedInfo.conventions || {},
      keyFeatures: Array.isArray(extractedInfo.keyFeatures) ? extractedInfo.keyFeatures : []
    }

    console.log('Extracted project info:', result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Project extraction error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Sanitize project name to be kebab-case and filesystem-safe
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .slice(0, 50)                  // Limit length
}
