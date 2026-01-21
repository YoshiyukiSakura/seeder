import DocsSidebar from '@/components/docs/DocsSidebar'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      <DocsSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
