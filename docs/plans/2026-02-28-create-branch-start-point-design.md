# Create Command: Branch Start Point Selection

## Problem

When running `simtree create <branch>`, the new branch always forks from whatever HEAD is at the current checkout. If you're on `feature/auth` and create a new branch, it silently forks from `feature/auth` rather than `main`. This is often not what you want.

## Design

### Global config: `~/.simtree/config.json`

New global config file with a `defaultBranch` field (defaults to `"main"`):

```json
{
  "defaultBranch": "main"
}
```

### Prompt in create command

When creating a **new** branch and the current branch is not the configured default branch, prompt:

```
You're currently on branch "feature/auth".
Where should the new branch start from?
  > Current branch (feature/auth)
    Default branch (main)
```

Skip the prompt when:
- The branch already exists (has its own history)
- The current branch IS the default branch (nothing to choose)

### Git mechanism

Use the native start-point argument: `git worktree add "<path>" -b "<branch>" "<start-point>"`. This uses the start branch as a commit reference without checking it out, so no conflicts with existing worktrees.

### Changes

1. **`state.ts`** — Add `GlobalConfig` interface, `readGlobalConfig()`, `writeGlobalConfig()`, `getDefaultBranch()` (reads config, falls back to `"main"`)
2. **`git.ts`** — Add optional `startPoint` parameter to `createWorktree()`
3. **`commands/create.ts`** — Add prompt when current branch != default branch and branch is new
4. **`commands/move.ts`** — Replace hardcoded `main`/`master` detection with `getDefaultBranch()`
