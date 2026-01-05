/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
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
    '/node_modules/(?!(jose|@linear/sdk)/)',
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
}

module.exports = config
