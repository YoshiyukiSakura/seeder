import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

// Map MIME types to file extensions
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

// Temporary upload directory (relative to project root)
const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads')

export async function POST(request: NextRequest) {
  try {
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    const formData = await request.formData()
    const files = formData.getAll('images')

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No images provided. Please upload at least one image using the "images" field.' },
        { status: 400 }
      )
    }

    const uploadedPaths: string[] = []
    const errors: string[] = []

    for (const file of files) {
      // Check if it's a valid File object
      if (!(file instanceof File)) {
        errors.push('Invalid file object received')
        continue
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(`Invalid file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`)
        continue
      }

      // Generate unique filename
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const ext = MIME_TO_EXT[file.type] || '.bin'
      const filename = `${timestamp}-${randomSuffix}${ext}`
      const filepath = path.join(UPLOAD_DIR, filename)

      // Read file buffer and write to disk
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filepath, buffer)

      uploadedPaths.push(filepath)
    }

    // If no files were successfully uploaded
    if (uploadedPaths.length === 0) {
      return NextResponse.json(
        { error: 'No valid images were uploaded', details: errors },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      paths: uploadedPaths,
      count: uploadedPaths.length,
      ...(errors.length > 0 && { warnings: errors }),
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload images', details: String(error) },
      { status: 500 }
    )
  }
}
