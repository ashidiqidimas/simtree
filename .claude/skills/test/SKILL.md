---
name: test
description: Use when running tests, writing new tests, or verifying changes work correctly
---

# Testing

Run tests with Vitest.

## Commands

- `pnpm test` — run all tests once
- `pnpm test:watch` — run in watch mode

## Structure

```
test/
  e2e/           # End-to-end tests using real git repos
```

## Writing E2E Tests

E2E tests create temporary git repos to test real git worktree operations.

Use `fs.realpathSync(fs.mkdtempSync(...))` for temp dirs — macOS `/var` symlinks to `/private/var` and git resolves the real path.

Always clean up worktrees in `afterEach` before removing the temp directory.

## Conventions

- Test files: `test/**/*.test.ts`
- Use `describe`/`it` from vitest
- Functions to test must be exported from `src/` modules
