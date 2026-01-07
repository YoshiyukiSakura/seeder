import { LinearClient } from '@linear/sdk'

const LINEAR_TOKEN = 'lin_api_x8sSVXdZ73DmxlHD6KH9sPsZhjHiYHmwLE0tbrRc'

async function main() {
  const client = new LinearClient({ apiKey: LINEAR_TOKEN })

  // 搜索 WT-13 到 WT-23 (number 13-23)
  for (let num = 13; num <= 23; num++) {
    try {
      // 用 number 过滤
      const issues = await client.issues({
        filter: { number: { eq: num } }
      })

      const issue = issues.nodes[0]
      if (issue && issue.identifier.startsWith('WT-')) {
        console.log(`Deleting ${issue.identifier}...`)
        await issue.delete()
        console.log(`✓ Deleted ${issue.identifier}`)
      } else if (issue) {
        console.log(`✗ ${issue.identifier} is not WT team, skipping`)
      } else {
        console.log(`✗ Issue #${num} not found`)
      }
    } catch (error: any) {
      console.error(`Error with #${num}:`, error.message || error)
    }
  }

  console.log('Done!')
}

main()
