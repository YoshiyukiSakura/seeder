# Prevent Duplicate Projects (Seedbed)

## Problem
E2E runs (and some manual flows) create multiple database Project rows that refer to the same local repo/path. This causes repeated entries in the project dropdown and inconsistent history views.

## Goals
- Make project creation idempotent for the same repo/path.
- Prevent future duplicates at the database layer.
- Clean up existing duplicates without losing plan/task history.

## Non-Goals
- Changing user-visible project names or descriptions beyond dedupe needs.
- Migrating historical data across users/teams beyond the duplicate scope.

## Proposed Approach
1. Server-side idempotency:
   - In `POST /api/projects`, before creating:
     - If `localPath` is provided, look up an existing Project by `localPath` (optionally scoped to `userId`).
     - Else if `gitUrl` is provided, look up by `gitUrl` + `gitBranch` (optionally scoped to `userId`).
     - If found, return the existing project (200) instead of creating a new one.
   - Optionally update missing fields (description, techStack) on the existing project when safe.

2. Database-level guard:
   - Add a unique constraint on `Project.localPath` when present.
   - If we want multi-user separation, use a composite unique index on `(userId, localPath)`.
   - Add a unique constraint on `(userId, gitUrl, gitBranch)` for non-local projects.

3. Cleanup existing duplicates:
   - Identify duplicate groups (same `localPath`, or same `gitUrl` + `gitBranch`).
   - Pick a canonical Project per group (most recently updated, or with most plans).
   - Repoint related rows (Plan, Task, Execution, IssueExecution) to the canonical project.
   - Delete the redundant Project rows after migration.

4. E2E safeguards:
   - Ensure E2E project creation always passes a stable `id` and `localPath`.
   - Add an E2E check that `POST /api/projects` is idempotent.

## Implementation Steps
1. Update `POST /api/projects` to be idempotent based on `localPath`/`gitUrl`.
2. Add a Prisma migration for unique indexes (localPath and/or composite keys).
3. Write a one-time cleanup script to merge duplicates safely.
4. Add tests:
   - API unit test for idempotent create.
   - E2E check for duplicate-free list.
5. Verify UI:
   - Dropdown shows single entry for the repo.
   - Plan history loads correctly for the canonical project.

## Open Questions
- Should uniqueness be global or scoped by user/team?
- What is the desired behavior when `localPath` changes for the same repo?
- Do we need to merge duplicate projects across different users or keep them separate?

## Acceptance Criteria
- Repeated creation calls for the same repo return the same Project ID.
- Database enforces uniqueness for repo identity.
- Existing duplicates are merged without data loss.
- Project dropdown shows no duplicates for the same repo.
