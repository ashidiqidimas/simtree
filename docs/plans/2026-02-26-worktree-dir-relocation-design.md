# Worktree Directory Relocation Design

## Problem

Worktrees are stored at `<repo>/.worktrees/<branch>`, cluttering the repository directory. Move them to the global `~/.simtree/` directory alongside existing state files (simulators, locks).

## Decision

Relocate worktrees to `~/.simtree/worktrees/<repoName>-<shortHash>/<branch>/`.

- **repoName**: `path.basename(repoRoot)` (human-readable)
- **shortHash**: first 4 chars of MD5 of the repo's absolute path (uniqueness guarantee)
- **No migration**: existing worktrees must be closed and recreated manually
- **Hardcoded path**: `~/.simtree/worktrees/` is not configurable

Example: repo at `/Users/dimas/Projects/MyApp` produces `~/.simtree/worktrees/MyApp-7b2e/`.

## Files Changed

### 1. `src/git.ts` — `getWorktreesDir()`

Update to return `~/.simtree/worktrees/<repoName>-<shortHash>/` instead of `<repoRoot>/.worktrees`. Add `crypto` and `os` imports. Add a helper to compute the short hash.

All commands (`create`, `close`, `list`, `move`) already call this function, so the change propagates automatically.

### 2. `src/commands/completions.ts` — zsh completion script

Update `_simtree_worktree_branches()` to compute the same namespaced path in shell:

```zsh
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
repo_name="${repo_root:t}"
short_hash="$(echo -n "$repo_root" | md5 | cut -c1-4)"
worktrees_dir="$HOME/.simtree/worktrees/${repo_name}-${short_hash}"
```

Uses macOS `md5` command to match Node.js `crypto.createHash("md5")` output.

## What Does NOT Change

- Lock management (`src/state.ts`) — stores absolute paths, works regardless of location
- Command logic — all commands use `getWorktreesDir()` abstraction
- Per-repo config (`.simtree` file) — unrelated to worktree storage path
- Global state location (`~/.simtree/simulators.json`, `locks.json`) — unchanged
