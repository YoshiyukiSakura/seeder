import React from 'react'

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8 text-white">Documentation</h1>

        <ProjectsSection />
      </div>
    </div>
  )
}

function ProjectsSection() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">
          Creating Projects from Git URL
        </h2>
        <p className="text-gray-300 mb-6">
          Seedbed supports creating projects directly from Git repositories. Simply provide a Git URL,
          and the system will automatically clone the repository and analyze its contents using AI.
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-white">Quick Start</h3>
        <ol className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
            <span>Click the <strong className="text-white">Project Selector</strong> dropdown in the chat interface</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
            <span>Click <strong className="text-white">+ New Project</strong> at the bottom</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
            <span>Enter your Git URL in the <strong className="text-white">Git URL</strong> field</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
            <span>Click the <strong className="text-white">AI</strong> button to automatically analyze and fill in project details</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
            <span>Review the auto-filled information and make any necessary adjustments</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">6</span>
            <span>Click <strong className="text-white">Create Project</strong> to clone and save the project</span>
          </li>
        </ol>
      </div>

      {/* Supported Git URL Formats */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-white">Supported Git URL Formats</h3>
        <p className="text-gray-300 mb-4">
          Seedbed supports both HTTPS and SSH formats for Git URLs:
        </p>

        <div className="space-y-4">
          {/* HTTPS Format */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-400 uppercase">HTTPS</span>
              <span className="text-xs text-gray-500">(Recommended for public repositories)</span>
            </div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              https://github.com/owner/repository.git
            </code>
            <p className="text-xs text-gray-500 mt-2">
              Example: https://github.com/vercel/next.js.git
            </p>
          </div>

          {/* SSH Format */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-purple-400 uppercase">SSH</span>
              <span className="text-xs text-gray-500">(Recommended for private repositories)</span>
            </div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              git@github.com:owner/repository.git
            </code>
            <p className="text-xs text-gray-500 mt-2">
              Example: git@github.com:vercel/next.js.git
            </p>
          </div>
        </div>
      </div>

      {/* AI Analysis Feature */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-white">AI-Powered Auto-Fill</h3>
        <p className="text-gray-300 mb-4">
          The AI analysis feature automatically extracts and fills in project information by analyzing
          the repository's contents. This includes:
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <ul className="space-y-3 text-gray-300">
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">Project Name</strong>
                <p className="text-sm text-gray-400">Extracted from repository name and formatted for readability</p>
              </div>
            </li>
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">Description</strong>
                <p className="text-sm text-gray-400">Generated from README.md and repository analysis</p>
              </div>
            </li>
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">Tech Stack</strong>
                <p className="text-sm text-gray-400">Detected from package.json, dependencies, and file types</p>
              </div>
            </li>
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">Default Branch</strong>
                <p className="text-sm text-gray-400">Automatically detected (main, master, etc.)</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-300 text-sm">
                <strong>Tip:</strong> You can still manually edit any auto-filled fields before creating the project.
                The AI analysis is a starting point to save you time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What Happens After Creation */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-white">What Happens After Creation</h3>
        <p className="text-gray-300 mb-4">
          When you create a project with a Git URL, Seedbed performs the following actions:
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <ol className="space-y-4 text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div className="flex-1">
                <strong className="text-white">Repository Clone</strong>
                <p className="text-sm text-gray-400 mt-1">
                  The repository is cloned to your local <code className="bg-gray-900 px-2 py-0.5 rounded text-green-400">~/projects/</code> directory
                </p>
                <code className="block bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm mt-2">
                  ~/projects/repository-name/
                </code>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div className="flex-1">
                <strong className="text-white">Branch Checkout</strong>
                <p className="text-sm text-gray-400 mt-1">
                  The specified branch (or default branch) is checked out automatically
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div className="flex-1">
                <strong className="text-white">Project Saved</strong>
                <p className="text-sm text-gray-400 mt-1">
                  Project metadata is saved to the database and becomes available in the Project Selector
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div className="flex-1">
                <strong className="text-white">Ready to Use</strong>
                <p className="text-sm text-gray-400 mt-1">
                  You can now select the project and start working with it in your chats
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      {/* Code Example */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-white">Example Workflow</h3>
        <p className="text-gray-300 mb-4">
          Here's a complete example of creating a project from a GitHub repository:
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">Step 1: Enter Git URL</div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              https://github.com/vercel/next.js.git
            </code>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">Step 2: Click AI Button (Auto-fills)</div>
            <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Name:</span>
                <span className="text-green-400">Next.js</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Description:</span>
                <span className="text-green-400">The React Framework for the Web</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Tech Stack:</span>
                <span className="text-green-400">React, TypeScript, Node.js</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Branch:</span>
                <span className="text-green-400">canary</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">Step 3: Result</div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              Project cloned to: ~/projects/next.js/
            </code>
          </div>
        </div>
      </div>

      {/* Tips and Best Practices */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-white">Tips & Best Practices</h3>
        <div className="space-y-3">
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-green-300 text-sm">
                  <strong>Use SSH for private repositories</strong> - SSH authentication is more secure and doesn't require
                  entering credentials repeatedly.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-yellow-300 text-sm">
                  <strong>Large repositories may take longer to clone</strong> - The system has a 5-minute timeout
                  for clone operations. Consider using shallow clones for very large repositories.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-300 text-sm">
                  <strong>Private repository access</strong> - For private repositories, ensure the server's GitHub
                  account has been granted access. See the{' '}
                  <a href="/docs/adding-projects" className="underline hover:text-blue-200">
                    full documentation
                  </a>{' '}
                  for details.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-white">Troubleshooting</h3>
        <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              "Permission denied" error when cloning
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              Ensure the server's GitHub account has access to the repository. For private repositories,
              you need to add the server account as a collaborator with at least Read access.
            </p>
          </details>

          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              "Repository not found" error
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              Verify that the Git URL is correct and that the repository exists. Also check that the
              repository is accessible (public or you have the necessary permissions).
            </p>
          </details>

          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              AI analysis fails or returns incomplete data
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              The AI analysis requires access to the repository. If it fails, you can still manually
              fill in the project details and create the project. The analysis is optional.
            </p>
          </details>

          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              Clone operation times out
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              Large repositories may exceed the 5-minute timeout. Consider cloning the repository
              manually to ~/projects/ and then using the "Save Local Project" feature instead.
            </p>
          </details>
        </div>
      </div>
    </section>
  )
}
