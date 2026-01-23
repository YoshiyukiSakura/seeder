/**
 * Prompt for extracting project information from conversation content
 */
export function buildProjectExtractionPrompt(conversationContent: string): string {
  return `Analyze the following conversation and extract project information. The conversation describes a software project idea or requirements.

<conversation>
${conversationContent}
</conversation>

Extract and return the following information in JSON format:

1. suggestedName: A short, kebab-case name for the project (e.g., "task-manager", "chat-app")
2. displayName: A human-readable display name (e.g., "Task Manager", "Chat Application")
3. description: A concise description of the project (2-3 sentences max)
4. techStack: An array of technologies that would be used (e.g., ["Next.js", "TypeScript", "PostgreSQL"])
5. conventions: An object with:
   - language: Primary programming language
   - framework: Main framework (if any)
   - codeStyle: Code style preferences mentioned
   - architecture: Architectural patterns mentioned
6. keyFeatures: An array of key features/functionality the project should have

Respond ONLY with valid JSON, no additional text or explanation.

Example response format:
{
  "suggestedName": "project-name",
  "displayName": "Project Name",
  "description": "A brief description of what the project does.",
  "techStack": ["Next.js", "TypeScript", "PostgreSQL"],
  "conventions": {
    "language": "TypeScript",
    "framework": "Next.js",
    "codeStyle": "ESLint + Prettier",
    "architecture": "App Router with API routes"
  },
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"]
}`
}

/**
 * Template for generating CLAUDE.md content
 */
export const CLAUDE_MD_TEMPLATE = `# {PROJECT_NAME}

{DESCRIPTION}

## Tech Stack

{TECH_STACK}

## Project Structure

- \`src/\` - Source code
- \`tests/\` - Test files

## Development Guidelines

{CONVENTIONS}

## Key Features

{FEATURES}
`

/**
 * Generate CLAUDE.md content from extracted project info
 */
export function generateClaudeMd(projectInfo: {
  displayName: string
  description: string
  techStack: string[]
  conventions?: {
    language?: string
    framework?: string
    codeStyle?: string
    architecture?: string
  }
  keyFeatures?: string[]
}): string {
  const { displayName, description, techStack, conventions, keyFeatures } = projectInfo

  // Format tech stack as bullet list
  const techStackFormatted = techStack.length > 0
    ? techStack.map(t => `- ${t}`).join('\n')
    : '- To be determined'

  // Format conventions
  const conventionsFormatted = conventions
    ? [
        conventions.language && `- **Language**: ${conventions.language}`,
        conventions.framework && `- **Framework**: ${conventions.framework}`,
        conventions.codeStyle && `- **Code Style**: ${conventions.codeStyle}`,
        conventions.architecture && `- **Architecture**: ${conventions.architecture}`,
      ].filter(Boolean).join('\n') || '- To be determined'
    : '- To be determined'

  // Format features
  const featuresFormatted = keyFeatures && keyFeatures.length > 0
    ? keyFeatures.map(f => `- ${f}`).join('\n')
    : '- To be determined'

  return CLAUDE_MD_TEMPLATE
    .replace('{PROJECT_NAME}', displayName)
    .replace('{DESCRIPTION}', description)
    .replace('{TECH_STACK}', techStackFormatted)
    .replace('{CONVENTIONS}', conventionsFormatted)
    .replace('{FEATURES}', featuresFormatted)
}

export interface ExtractedProjectInfo {
  suggestedName: string
  displayName: string
  description: string
  techStack: string[]
  conventions?: {
    language?: string
    framework?: string
    codeStyle?: string
    architecture?: string
  }
  keyFeatures?: string[]
}
