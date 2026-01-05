import { NextRequest } from 'next/server'
import { runClaude } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const { answer, projectPath } = await request.json()

  if (!answer) {
    return new Response(JSON.stringify({ error: 'answer is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const cwd = projectPath || process.cwd()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runClaude(answer, cwd, true)) {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }
      } catch (error) {
        const errorEvent = { type: 'error', data: { message: String(error) } }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
