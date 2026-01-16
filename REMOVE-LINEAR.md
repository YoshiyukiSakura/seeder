# Linear Removal Plan

**Decision Date:** 2026-01-15
**Decision:** Remove Linear integration entirely

## Background

Cross-project negotiation between Seedbed and Farmer revealed:

1. **Seedbed** has ~2,200 lines of Linear-specific code
2. **Farmer** has zero Linear usage - reads directly from database, outputs to GitHub
3. Linear served as a human team coordination layer, but Farmer bypasses it completely
4. The two workflows never connect

## Rationale

- Simplify architecture by removing unused integration layer
- Farmer is the primary execution path, and it doesn't use Linear
- Reduces maintenance burden and external dependencies

## Action Items

### Phase 1: Remove Linear Code

- [ ] Delete `/src/lib/linear/client.ts`
- [ ] Delete `/src/lib/linear/publish.ts`
- [ ] Delete `/scripts/cleanup-linear.ts`
- [ ] Delete `/src/app/api/linear/` directory (all routes)
- [ ] Delete `/src/components/publish/PublishDialog.tsx`
- [ ] Remove Linear section from `/src/app/settings/page.tsx`

### Phase 2: Update Database Schema

- [ ] Remove `linearToken` from `User` model
- [ ] Remove `linearProjectId` from `Plan` model
- [ ] Remove `linearIssueId` from `Task` model
- [ ] Remove `linearIssueId` from `IssueExecution` model
- [ ] Create and run migration

### Phase 3: Update UI

- [ ] Remove "Publish to Linear" button from Plan view
- [ ] Update Plan status flow (remove "PUBLISHED" status or repurpose it)
- [ ] Update settings page to remove Linear configuration

### Phase 4: Remove Dependencies

- [ ] Remove `@linear/sdk` from `package.json`
- [ ] Run `npm install` to update lockfile

### Phase 5: Remove Tests

- [ ] Delete `/tests/unit/lib/linear.test.ts`
- [ ] Delete `/tests/integration/api/linear.test.ts`
- [ ] Delete `/tests/e2e/linear.spec.ts`
- [ ] Update any other tests that reference Linear

### Phase 6: Update Documentation

- [ ] Update `plan.md` to remove Linear references
- [ ] Update README if it mentions Linear
- [ ] Update any API documentation

## New Workflow

After removal:

```
User creates plan in Seedbed
         |
AI generates tasks
         |
User reviews & edits tasks
         |
[NEW] Plan is saved to database (no external publish)
         |
Farmer reads from database
         |
Farmer executes tasks
         |
PR created on GitHub
```

## Impact on Farmer

**None.** Farmer already reads from the shared database and never used Linear.

## Alternative: Future Consideration

If task tracking is needed in the future, consider:
- GitHub Issues as the tracking layer (Farmer already creates PRs)
- Internal status tracking in Seedbed UI
- Simple webhook notifications
