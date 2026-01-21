/**
 * Test script for validateGitUrl function
 * Tests both standard SSH format and custom host format
 */

import { validateGitUrl } from './src/lib/git-utils'

interface TestCase {
  description: string
  url: string
  expected: boolean
}

const testCases: TestCase[] = [
  // Standard SSH format tests
  {
    description: 'Standard SSH format with .git',
    url: 'git@github.com:owner/repo.git',
    expected: true,
  },
  {
    description: 'Standard SSH format without .git',
    url: 'git@github.com:owner/repo',
    expected: true,
  },
  {
    description: 'Standard SSH format with underscores',
    url: 'git@github.com:my_owner/my_repo.git',
    expected: true,
  },
  {
    description: 'Standard SSH format with dots',
    url: 'git@github.com:my.owner/my.repo.git',
    expected: true,
  },
  {
    description: 'Standard SSH format with hyphens',
    url: 'git@github.com:my-owner/my-repo.git',
    expected: true,
  },

  // Custom host format tests
  {
    description: 'Custom host with subdomain',
    url: 'git@git.company.com:owner/repo.git',
    expected: true,
  },
  {
    description: 'Custom host with multiple subdomains',
    url: 'git@code.dev.company.com:owner/repo.git',
    expected: true,
  },
  {
    description: 'Custom host without .git',
    url: 'git@gitlab.example.com:team/project',
    expected: true,
  },
  {
    description: 'Custom host with hyphenated domain',
    url: 'git@git-server.example.com:owner/repo.git',
    expected: true,
  },
  {
    description: 'Custom host with numbers in domain',
    url: 'git@git123.example.com:owner/repo.git',
    expected: true,
  },

  // HTTPS format tests (for completeness)
  {
    description: 'HTTPS format with .git',
    url: 'https://github.com/owner/repo.git',
    expected: true,
  },
  {
    description: 'HTTPS format without .git',
    url: 'https://github.com/owner/repo',
    expected: true,
  },

  // Invalid format tests
  {
    description: 'Invalid - missing git@ prefix',
    url: 'github.com:owner/repo.git',
    expected: false,
  },
  {
    description: 'Invalid - missing colon',
    url: 'git@github.com/owner/repo.git',
    expected: false,
  },
  {
    description: 'Invalid - http instead of https',
    url: 'http://github.com/owner/repo.git',
    expected: false,
  },
  {
    description: 'Invalid - empty string',
    url: '',
    expected: false,
  },
  {
    description: 'Invalid - malformed SSH',
    url: 'git@:owner/repo.git',
    expected: false,
  },
]

function runTests() {
  console.log('🧪 Testing validateGitUrl function\n')
  console.log('='.repeat(80))

  let passed = 0
  let failed = 0
  const failures: { test: TestCase; actual: boolean }[] = []

  testCases.forEach((testCase) => {
    const result = validateGitUrl(testCase.url)
    const success = result === testCase.expected

    if (success) {
      passed++
      console.log(`✅ PASS: ${testCase.description}`)
      console.log(`   URL: ${testCase.url}`)
      console.log(`   Expected: ${testCase.expected}, Got: ${result}`)
    } else {
      failed++
      failures.push({ test: testCase, actual: result })
      console.log(`❌ FAIL: ${testCase.description}`)
      console.log(`   URL: ${testCase.url}`)
      console.log(`   Expected: ${testCase.expected}, Got: ${result}`)
    }
    console.log('')
  })

  console.log('='.repeat(80))
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed (${testCases.length} total)`)

  if (failures.length > 0) {
    console.log('\n❌ Failed Tests:')
    failures.forEach(({ test, actual }) => {
      console.log(`  - ${test.description}`)
      console.log(`    URL: ${test.url}`)
      console.log(`    Expected: ${test.expected}, Got: ${actual}`)
    })
    process.exit(1)
  } else {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  }
}

runTests()
