/**
 * SSE event fixtures for Slack Bot tests
 */

import type { AnySSEEvent } from '../../src/services/seedbed-api'

/**
 * Init event fixtures
 */
export const initEvents = {
  newConversation: {
    type: 'init' as const,
    data: {
      cwd: '/test/project',
      resuming: false,
      tools: 5,
      sessionId: 'session-new-123',
    },
  } satisfies AnySSEEvent,

  resumingConversation: {
    type: 'init' as const,
    data: {
      cwd: '/test/project',
      resuming: true,
      tools: 5,
      sessionId: 'session-resume-456',
    },
  } satisfies AnySSEEvent,
}

/**
 * Text event fixtures
 */
export const textEvents = {
  simple: {
    type: 'text' as const,
    data: { content: 'Hello!' },
  } satisfies AnySSEEvent,

  withNewline: {
    type: 'text' as const,
    data: { content: 'Hello!\n' },
  } satisfies AnySSEEvent,

  multiline: {
    type: 'text' as const,
    data: { content: 'Line 1\nLine 2\nLine 3' },
  } satisfies AnySSEEvent,

  codeBlock: {
    type: 'text' as const,
    data: { content: '```typescript\nconst x = 1;\n```' },
  } satisfies AnySSEEvent,
}

/**
 * Question event fixtures
 */
export const questionEvents = {
  singleChoice: {
    type: 'question' as const,
    data: {
      toolUseId: 'tool-question-123',
      questions: [
        {
          question: 'Which option do you prefer?',
          header: 'Choose One',
          options: [
            { label: 'Option A', description: 'First option description' },
            { label: 'Option B', description: 'Second option description' },
          ],
          multiSelect: false,
        },
      ],
    },
  } satisfies AnySSEEvent,

  multiSelect: {
    type: 'question' as const,
    data: {
      toolUseId: 'tool-multi-456',
      questions: [
        {
          question: 'Select all that apply',
          header: 'Multiple Selection',
          options: [
            { label: 'Feature A' },
            { label: 'Feature B' },
            { label: 'Feature C' },
          ],
          multiSelect: true,
        },
      ],
    },
  } satisfies AnySSEEvent,

  noOptions: {
    type: 'question' as const,
    data: {
      toolUseId: 'tool-text-789',
      questions: [
        {
          question: 'Please provide your input:',
        },
      ],
    },
  } satisfies AnySSEEvent,
}

/**
 * Tool event fixtures
 */
export const toolEvents = {
  readFile: {
    type: 'tool' as const,
    data: {
      name: 'ReadFile',
      id: 'tool-read-123',
      summary: '/src/index.ts',
      timestamp: Date.now(),
    },
  } satisfies AnySSEEvent,

  writeFile: {
    type: 'tool' as const,
    data: {
      name: 'WriteFile',
      id: 'tool-write-456',
      summary: '/src/new-file.ts',
      timestamp: Date.now(),
    },
  } satisfies AnySSEEvent,

  bash: {
    type: 'tool' as const,
    data: {
      name: 'Bash',
      id: 'tool-bash-789',
      summary: 'npm install',
      timestamp: Date.now(),
    },
  } satisfies AnySSEEvent,
}

/**
 * Result event fixtures
 */
export const resultEvents = {
  success: {
    type: 'result' as const,
    data: {
      content: 'Task completed successfully',
      planId: 'plan-result-123',
    },
  } satisfies AnySSEEvent,

  withoutPlan: {
    type: 'result' as const,
    data: {
      content: 'Done',
    },
  } satisfies AnySSEEvent,
}

/**
 * Error event fixtures
 */
export const errorEvents = {
  validation: {
    type: 'error' as const,
    data: {
      message: 'Invalid input provided',
      errorType: 'validation_error' as const,
      code: 'INVALID_INPUT',
      recoverable: false,
    },
  } satisfies AnySSEEvent,

  session: {
    type: 'error' as const,
    data: {
      message: 'Session expired',
      errorType: 'session_error' as const,
      code: 'SESSION_EXPIRED',
      recoverable: true,
    },
  } satisfies AnySSEEvent,

  auth: {
    type: 'error' as const,
    data: {
      message: 'Unauthorized',
      errorType: 'auth_error' as const,
      code: 'UNAUTHORIZED',
      recoverable: false,
    },
  } satisfies AnySSEEvent,

  timeout: {
    type: 'error' as const,
    data: {
      message: 'Request timed out',
      errorType: 'timeout_error' as const,
      code: 'TIMEOUT',
      recoverable: true,
    },
  } satisfies AnySSEEvent,

  process: {
    type: 'error' as const,
    data: {
      message: 'Process failed',
      errorType: 'process_error' as const,
      recoverable: false,
    },
  } satisfies AnySSEEvent,

  unknown: {
    type: 'error' as const,
    data: {
      message: 'Unknown error occurred',
      errorType: 'unknown_error' as const,
      recoverable: false,
    },
  } satisfies AnySSEEvent,
}

/**
 * Done event fixtures
 */
export const doneEvents = {
  simple: {
    type: 'done' as const,
    data: {},
  } satisfies AnySSEEvent,
}

/**
 * Git sync event fixtures
 */
export const gitSyncEvents = {
  success: {
    type: 'git_sync' as const,
    data: {
      success: true,
      message: 'Repository synchronized',
      updated: true,
    },
  } satisfies AnySSEEvent,

  noChanges: {
    type: 'git_sync' as const,
    data: {
      success: true,
      message: 'No changes to sync',
      updated: false,
    },
  } satisfies AnySSEEvent,

  failed: {
    type: 'git_sync' as const,
    data: {
      success: false,
      message: 'Failed to sync: conflict detected',
      updated: false,
    },
  } satisfies AnySSEEvent,
}

/**
 * Plan created event fixtures
 */
export const planCreatedEvents = {
  simple: {
    type: 'plan_created' as const,
    data: {
      planId: 'plan-abc123',
    },
  } satisfies AnySSEEvent,
}

/**
 * Typical conversation flow sequences
 */
export const conversationFlows = {
  /**
   * Simple successful conversation
   */
  simple: [
    planCreatedEvents.simple,
    initEvents.newConversation,
    textEvents.simple,
    resultEvents.success,
    doneEvents.simple,
  ],

  /**
   * Conversation with question
   */
  withQuestion: [
    planCreatedEvents.simple,
    initEvents.newConversation,
    textEvents.simple,
    questionEvents.singleChoice,
  ],

  /**
   * Conversation with tool usage
   */
  withTools: [
    planCreatedEvents.simple,
    initEvents.newConversation,
    textEvents.simple,
    toolEvents.readFile,
    toolEvents.writeFile,
    textEvents.multiline,
    resultEvents.success,
    doneEvents.simple,
  ],

  /**
   * Conversation with error
   */
  withError: [
    planCreatedEvents.simple,
    initEvents.newConversation,
    textEvents.simple,
    errorEvents.validation,
  ],

  /**
   * Resumed conversation
   */
  resumed: [
    initEvents.resumingConversation,
    textEvents.simple,
    resultEvents.success,
    doneEvents.simple,
  ],

  /**
   * Conversation with git sync
   */
  withGitSync: [
    planCreatedEvents.simple,
    initEvents.newConversation,
    gitSyncEvents.success,
    textEvents.simple,
    resultEvents.success,
    doneEvents.simple,
  ],
}

/**
 * API response fixtures
 */
export const apiResponses = {
  channelToProject: {
    success: {
      projectId: 'proj-123',
      projectName: 'test-project',
    },
    notFound: null,
  },

  threadToPlan: {
    success: {
      planId: 'plan-123',
      planName: 'test-plan',
      sessionId: 'session-123',
      projectPath: '/path/to/project',
    },
    notFound: null,
  },

  token: {
    success: {
      token: 'token-abc123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  },
}
