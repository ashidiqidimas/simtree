# Hook System Design

## Problem

Users need to run custom commands at key points in the worktree lifecycle. For example, running `tuist install && tuist cache && tuist generate --no-open` after creating a worktree for an iOS project.

## Design

### Convention-Based Hook Directory

Hooks live in a fixed directory with well-known filenames:

```
~/.simtree/hooks/
  post-create.sh    # runs after worktree creation
  post-close.sh     # runs after worktree removal
```

The directory respects `SIMTREE_HOME`, so the actual path is `$SIMTREE_HOME/hooks/` (defaults to `~/.simtree/hooks/`).

### Hook Discovery

- If `<simtreeDir>/hooks/<hookName>.sh` exists, run it
- If the file doesn't exist, silently skip (no warning)
- Scripts are executed via `sh <path>`, so no `chmod +x` required

### Execution Timing

**post-create** — runs after all setup is complete, before the "open in editor" prompt:

1. Git worktree created
2. Files copied
3. Simulator assigned
4. Xcodebuildmcp config generated
5. **post-create.sh runs here**
6. "Open in editor?" prompt

**post-close** — runs after cleanup, before the branch deletion prompt:

1. Git worktree removed
2. Simulator unlocked
3. **post-close.sh runs here**
4. Branch deletion prompt

### Execution Context

**Working directory:**
- `post-create`: the newly created worktree path
- `post-close`: the main repo root (worktree is already removed)

**Environment variables:**

| Variable | post-create | post-close | Description |
|---|---|---|---|
| `SIMTREE_BRANCH` | yes | yes | Branch name |
| `SIMTREE_WORKTREE_PATH` | yes | yes | Worktree path |
| `SIMTREE_REPO_ROOT` | yes | yes | Main repo root |
| `SIMTREE_SIMULATOR_UDID` | yes | no | Assigned simulator UDID |
| `SIMTREE_SIMULATOR_NAME` | yes | no | Assigned simulator name |

### Error Handling

- If hook fails (non-zero exit), print stderr/stdout as a warning
- Command continues — hooks never abort the parent command
- Format: `Warning: post-create hook failed (exit code N):\n<output>`

## Implementation

New module `src/hooks.ts` with a single function:

```typescript
function runHook(
  hookName: string,
  env: Record<string, string>,
  cwd: string
): void
```

- Resolves path: `getSimtreeDir()/hooks/<hookName>.sh`
- Checks file existence, skips silently if missing
- Runs via `execSync('sh <path>', { env: {...process.env, ...env}, cwd, stdio: 'pipe' })`
- Catches errors, prints warning with output

The `create` and `close` commands call `runHook()` at the appropriate points, passing the relevant environment variables.
