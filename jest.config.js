/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  rootDir: '.',
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/generated/prisma/client$': '<rootDir>/tests/__mocks__/prismaClient.ts',
    '^jose$': '<rootDir>/tests/__mocks__/jose.ts',
    '^next/server$': '<rootDir>/tests/__mocks__/nextServer.ts',
    '^next/headers$': '<rootDir>/tests/__mocks__/nextHeaders.ts',
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '@testing-library/jest-dom',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',
    '/.next/',
    '/src/generated/',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
    '/src/generated/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/generated/**',
  ],
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/unit/**/*.test.tsx',
    '**/tests/integration/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Use different environments based on test type
  projects: [
    {
      // Unit tests for React components use jsdom
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/unit/**/*.test.tsx'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup.ts',
        '@testing-library/jest-dom',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/generated/prisma/client$': '<rootDir>/tests/__mocks__/prismaClient.ts',
        '^jose$': '<rootDir>/tests/__mocks__/jose.ts',
        '^next/server$': '<rootDir>/tests/__mocks__/nextServer.ts',
        '^next/headers$': '<rootDir>/tests/__mocks__/nextHeaders.ts',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
        }],
      },
    },
    {
      // Unit tests for Node.js code use node
      displayName: 'unit-node',
      testEnvironment: 'node',
      testMatch: ['**/tests/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/generated/prisma/client$': '<rootDir>/tests/__mocks__/prismaClient.ts',
        '^jose$': '<rootDir>/tests/__mocks__/jose.ts',
        '^next/server$': '<rootDir>/tests/__mocks__/nextServer.ts',
        '^next/headers$': '<rootDir>/tests/__mocks__/nextHeaders.ts',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
        }],
      },
    },
    {
      // Integration tests for API routes use node (for native fetch API)
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['**/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/generated/prisma/client$': '<rootDir>/tests/__mocks__/prismaClient.ts',
        '^jose$': '<rootDir>/tests/__mocks__/jose.ts',
        '^next/server$': '<rootDir>/tests/__mocks__/nextServer.ts',
        '^next/headers$': '<rootDir>/tests/__mocks__/nextHeaders.ts',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
        }],
      },
    },
  ],
}

module.exports = config
