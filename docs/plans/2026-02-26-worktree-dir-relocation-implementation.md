# Worktree Directory Relocation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move worktree storage from `<repo>/.worktrees/` to `~/.simtree/worktrees/<repoName>-<shortHash>/`.

**Architecture:** Update the single `getWorktreesDir()` function in `src/git.ts` to compute a global path using `~/.simtree/worktrees/` with a repo-namespaced subdirectory. Update the zsh completion script to compute the same path in shell.

**Tech Stack:** TypeScript, Node.js crypto module, zsh

---

### Task 1: Update `getWorktreesDir()` in `src/git.ts`

**Files:**
- Modify: `src/git.ts:1-16`

**Step 1: Add imports**

Add `crypto` and `os` imports at the top of `src/git.ts`:

```typescript
import crypto from "node:crypto"
import os from "node:os"
```

**Step 2: Add repo hash helper**

Add a helper function after `getRepoRoot()`:

```typescript
function repoNamespace(): string {
  const repoRoot = getRepoRoot()
  const repoName = path.basename(repoRoot)
  const shortHash = crypto.createHash("md5").update(repoRoot).digest("hex").slice(0, 4)
  return `${repoName}-${shortHash}`
}
```

**Step 3: Update `getWorktreesDir()`**

Replace the current implementation:

```typescript
export function getWorktreesDir(): string {
  return path.join(os.homedir(), ".simtree", "worktrees", repoNamespace())
}
```

**Step 4: Build and verify**

Run: `pnpm build`
Expected: Clean build, no errors

**Step 5: Manual smoke test**

Run: `simtree create test-relocation`
Expected: Worktree created at `~/.simtree/worktrees/simtree-XXXX/test-relocation/`

Run: `simtree list`
Expected: Shows the new worktree with the global path

Run: `simtree close test-relocation`
Expected: Worktree removed, simulator unlocked

**Step 6: Commit**

```bash
git add src/git.ts
git commit -m "feat: relocate worktrees to ~/.simtree/worktrees/"
```

---

### Task 2: Update zsh completions in `src/commands/completions.ts`

**Files:**
- Modify: `src/commands/completions.ts:14-21`

**Step 1: Update `_simtree_worktree_branches()` function**

Replace lines 14-21 of the zsh completion script with:

```zsh
_simtree_worktree_branches() {
  local repo_root repo_name short_hash worktrees_dir
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  repo_name="${repo_root:t}"
  short_hash="$(echo -n "$repo_root" | md5 | cut -c1-4)"
  worktrees_dir="$HOME/.simtree/worktrees/${repo_name}-${short_hash}"
  if [[ -d "$worktrees_dir" ]]; then
    local -a dirs
    dirs=(${worktrees_dir}/*(/:t))
    _describe 'worktree branch' dirs
  fi
}
```

**Step 2: Build**

Run: `pnpm build`
Expected: Clean build, no errors

**Step 3: Reinstall completions and verify**

Run: `simtree completions install`
Expected: Completions installed to `~/.zfunc/_simtree`

Run: `cat ~/.zfunc/_simtree | grep -A5 '_simtree_worktree_branches'`
Expected: Shows the new path computation logic with `md5` and `$HOME/.simtree/worktrees/`

**Step 4: Commit**

```bash
git add src/commands/completions.ts
git commit -m "feat: update zsh completions for new worktree path"
```

---

### Task 3: Rebuild and link

**Step 1: Final build and link**

Run: `pnpm link`
Expected: Clean build, global binary updated

**Step 2: Full end-to-end test**

Run: `simtree create e2e-test`
Expected: Worktree at `~/.simtree/worktrees/simtree-XXXX/e2e-test/`

Run: `simtree list`
Expected: Lists the worktree correctly

Run: `simtree close e2e-test`
Expected: Clean removal
