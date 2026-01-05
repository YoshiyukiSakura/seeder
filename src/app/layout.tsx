import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Seeder - AI Task Planning',
  description: 'Transform ideas into structured tasks',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="bg-gray-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
