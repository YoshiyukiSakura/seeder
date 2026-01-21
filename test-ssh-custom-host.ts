/**
 * Integration test for SSH custom host functionality
 * Tests cloning a repository using a custom SSH host (github-test)
 */

import { cloneRepository, extractRepoName } from './src/lib/git-utils'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

async function testCustomSshHost() {
  console.log('🧪 Testing SSH Custom Host Functionality\n')
  console.log('='.repeat(80))

  // Test 1: URL validation with custom host
  console.log('\n📝 Test 1: URL format with custom SSH host')
  const testUrl = 'git@github-test:Wildmeta-ai/seeder.git'
  console.log(`   URL: ${testUrl}`)
  const repoName = extractRepoName(testUrl)
  console.log(`   ✅ Extracted repo name: ${repoName}`)

  // Test 2: Actual clone using custom host
  console.log('\n📝 Test 2: Clone repository using custom SSH host')
  const tempDir = path.join(os.tmpdir(), 'seeder-test-clone-' + Date.now())
  console.log(`   Target: ${tempDir}`)

  try {
    console.log('   🔄 Cloning repository...')
    const result = await cloneRepository(testUrl, tempDir)

    if (result.success) {
      console.log('   ✅ Clone successful!')

      // Verify the clone
      const gitDir = path.join(tempDir, '.git')
      await fs.access(gitDir)
      console.log('   ✅ .git directory exists')

      // Verify package.json exists (expected in seeder repo)
      const packageJson = path.join(tempDir, 'package.json')
      await fs.access(packageJson)
      console.log('   ✅ package.json exists')

      // Clean up
      console.log('   🧹 Cleaning up test directory...')
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log('   ✅ Cleanup complete')

      console.log('\n' + '='.repeat(80))
      console.log('✅ All tests passed!')
      console.log('\n📊 Summary:')
      console.log('   - Custom SSH host "github-test" is configured correctly')
      console.log('   - SSH connection works (ssh -T git@github-test)')
      console.log('   - Git clone works with custom host')
      console.log('   - Ready for UI testing!')

      process.exit(0)
    } else {
      console.log(`   ❌ Clone failed: ${result.error}`)
      console.log('\n' + '='.repeat(80))
      console.log('❌ Test failed!')
      process.exit(1)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`)

    // Try to clean up on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    console.log('\n' + '='.repeat(80))
    console.log('❌ Test failed!')
    process.exit(1)
  }
}

testCustomSshHost()
