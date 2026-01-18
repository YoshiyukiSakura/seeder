/**
 * /api/images/upload
 * POST - 上传图片文件
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

// 允许的图片 MIME 类型
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

// 最大文件大小 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// 临时目录路径
const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads')

/**
 * 生成唯一文件名
 */
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName)
  const timestamp = Date.now()
  const randomStr = crypto.randomBytes(8).toString('hex')
  return `${timestamp}-${randomStr}${ext}`
}

/**
 * 验证文件类型
 */
function isValidImageType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

// POST /api/images/upload - 上传图片
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // 确保上传目录存在
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    const uploadedPaths: string[] = []
    const errors: string[] = []

    for (const file of files) {
      // 验证文件类型
      if (!isValidImageType(file.type)) {
        errors.push(`Invalid file type: ${file.name}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`)
        continue
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`File too large: ${file.name}. Maximum size: 5MB`)
        continue
      }

      // 生成唯一文件名并保存
      const fileName = generateFileName(file.name)
      const filePath = path.join(UPLOAD_DIR, fileName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      // 返回相对路径
      uploadedPaths.push(`/tmp/uploads/${fileName}`)
    }

    if (uploadedPaths.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'All files failed validation', details: errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        paths: uploadedPaths,
        ...(errors.length > 0 && { warnings: errors }),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Upload image error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
