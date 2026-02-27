# Create Branch Start Point Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When `simtree create` makes a new branch, prompt the user to choose between forking from the current branch or the configured default branch.

**Architecture:** Add a global config file (`~/.simtree/config.json`) with a `defaultBranch` field. Modify `createWorktree()` to accept an optional start-point. Add a prompt in the create command when the current branch differs from the default. Reuse `getDefaultBranch()` in the move command.

**Tech Stack:** TypeScript, commander, @inquirer/prompts, vitest

---

### Task 1: Add global config to state.ts

**Files:**
- Modify: `src/state.ts`

**Step 1: Write the failing test**

Create `test/unit/state.test.ts`:

```typescript
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

// We'll test the config functions by temporarily pointing SIMTREE_DIR to a temp dir.
// Since SIMTREE_DIR is a module-level const, we need to test via the exported functions
// and mock the filesystem.

describe("global config", () => {
  let tempDir: string
  let originalEnv: string | undefined

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "simtree-config-test-"))
    originalEnv = process.env.SIMTREE_HOME
    process.env.SIMTREE_HOME = tempDir
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SIMTREE_HOME
    } else {
      process.env.SIMTREE_HOME = originalEnv
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it("getDefaultBranch returns 'main' when no config exists", async () => {
    const { getDefaultBranch } = await import("../../src/state.js")
    expect(getDefaultBranch()).toBe("main")
  })

  it("getDefaultBranch returns configured value", async () => {
    fs.writeFileSync(
      path.join(tempDir, "config.json"),
      JSON.stringify({ defaultBranch: "develop" })
    )
    const { getDefaultBranch } = await import("../../src/state.js")
    expect(getDefaultBranch()).toBe("develop")
  })

  it("readGlobalConfig returns empty object when no config exists", async () => {
    const { readGlobalConfig } = await import("../../src/state.js")
    expect(readGlobalConfig()).toEqual({})
  })

  it("writeGlobalConfig persists config to disk", async () => {
    const { writeGlobalConfig, readGlobalConfig } = await import("../../src/state.js")
    writeGlobalConfig({ defaultBranch: "trunk" })
    expect(readGlobalConfig()).toEqual({ defaultBranch: "trunk" })
  })
})
```

**Important:** The `SIMTREE_DIR` const in `state.ts` is currently hardcoded. To make this testable, we need to extract it into a function that respects `SIMTREE_HOME` env var. This is done in Step 3.

**Step 2: Run test to verify it fails**

Run: `pnpm test test/unit/state.test.ts`
Expected: FAIL (imports don't exist yet, `SIMTREE_HOME` not respected)

**Step 3: Write implementation**

In `src/state.ts`, make these changes:

1. Replace the hardcoded `SIMTREE_DIR` const with a function:

```typescript
function getSimtreeDir(): string {
  return process.env.SIMTREE_HOME ?? path.join(os.homedir(), ".simtree")
}
```

2. Replace all references to `SIMTREE_DIR` with `getSimtreeDir()`:
   - `SIMULATORS_FILE` → function `getSimulatorsFile()`
   - `LOCKS_FILE` → function `getLocksFile()`
   - `CONFIG_TEMPLATE_FILE` → function `getConfigTemplateFile()` (this is exported, so also export the function)
   - `CONFIG_FILE` → new, for `config.json`

3. Add the new types and functions:

```typescript
export interface GlobalConfig {
  defaultBranch?: string
}

export function readGlobalConfig(): GlobalConfig {
  const configFile = path.join(getSimtreeDir(), "config.json")
  if (!fs.existsSync(configFile)) return {}
  const raw = fs.readFileSync(configFile, "utf-8")
  return JSON.parse(raw)
}

export function writeGlobalConfig(config: GlobalConfig): void {
  ensureDir()
  const configFile = path.join(getSimtreeDir(), "config.json")
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n")
}

export function getDefaultBranch(): string {
  const config = readGlobalConfig()
  return config.defaultBranch ?? "main"
}
```

4. Update `ensureDir()` to use `getSimtreeDir()`.

5. Update `CONFIG_TEMPLATE_FILE` export — since it changes from a const to a function, update the import in `src/config.ts` accordingly:
   - `src/config.ts` line 4: change `CONFIG_TEMPLATE_FILE` to `getConfigTemplateFile` and call it as a function on line 30.

**Step 4: Run test to verify it passes**

Run: `pnpm test test/unit/state.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (existing e2e tests still work)

**Step 6: Commit**

```bash
git add src/state.ts src/config.ts test/unit/state.test.ts
git commit -m "feat: add global config with defaultBranch setting"
```

---

### Task 2: Add start-point parameter to createWorktree

**Files:**
- Modify: `src/git.ts:36-50`

**Step 1: Write the failing test**

Add to `test/e2e/worktree-namespace.test.ts` (or create a new `test/e2e/create-worktree.test.ts`):

```typescript
// In a new file: test/e2e/create-worktree.test.ts
import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

function createTempRepo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "simtree-test-")))
  execSync("git init && git commit --allow-empty -m 'init'", {
    cwd: dir,
    stdio: "pipe",
  })
  return dir
}

describe("createWorktree with startPoint", () => {
  let mainRepo: string
  let originalCwd: string
  const worktreePaths: string[] = []

  beforeEach(() => {
    originalCwd = process.cwd()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    for (const wt of worktreePaths) {
      try {
        execSync(`git worktree remove "${wt}" --force`, {
          cwd: mainRepo,
          stdio: "pipe",
        })
      } catch {}
    }
    worktreePaths.length = 0
    if (mainRepo) {
      fs.rmSync(mainRepo, { recursive: true, force: true })
    }
  })

  it("creates worktree at specified start-point commit", () => {
    mainRepo = createTempRepo()
    process.chdir(mainRepo)

    // Create a commit on main
    execSync("git commit --allow-empty -m 'second commit'", { cwd: mainRepo, stdio: "pipe" })
    const mainHead = execSync("git rev-parse HEAD", { cwd: mainRepo, encoding: "utf-8" }).trim()

    // Create a feature branch with an extra commit
    execSync("git checkout -b feature-branch", { cwd: mainRepo, stdio: "pipe" })
    execSync("git commit --allow-empty -m 'feature commit'", { cwd: mainRepo, stdio: "pipe" })

    // Go back to feature-branch (we're already on it)
    // Now create a worktree for a new branch starting from main
    const wtPath = path.join(mainRepo, ".worktrees", "new-branch")
    execSync(`git worktree add "${wtPath}" -b new-branch main`, { cwd: mainRepo, stdio: "pipe" })
    worktreePaths.push(wtPath)

    // The new worktree should be at main's HEAD, not feature-branch's HEAD
    const wtHead = execSync("git rev-parse HEAD", { cwd: wtPath, encoding: "utf-8" }).trim()
    expect(wtHead).toBe(mainHead)
  })
})
```

**Step 2: Run test to verify it passes** (this tests git behavior, not our code yet)

Run: `pnpm test test/e2e/create-worktree.test.ts`
Expected: PASS (confirms git supports our approach)

**Step 3: Modify createWorktree to accept startPoint**

In `src/git.ts`, change `createWorktree`:

```typescript
export function createWorktree(branch: string, startPoint?: string): string {
  const worktreePath = path.join(getWorktreesDir(), branch)
  const useExistingBranch = branchExists(branch)

  let cmd: string
  if (useExistingBranch) {
    cmd = `git worktree add "${worktreePath}" "${branch}"`
  } else if (startPoint) {
    cmd = `git worktree add "${worktreePath}" -b "${branch}" "${startPoint}"`
  } else {
    cmd = `git worktree add "${worktreePath}" -b "${branch}"`
  }

  try {
    execSync(cmd, { stdio: "pipe" })
  } catch {
    console.error(`Error: failed to create worktree for branch "${branch}".`)
    process.exit(1)
  }
  return worktreePath
}
```

**Step 4: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/git.ts test/e2e/create-worktree.test.ts
git commit -m "feat: add start-point parameter to createWorktree"
```

---

### Task 3: Add branch start-point prompt to create command

**Files:**
- Modify: `src/commands/create.ts`

**Step 1: Modify create command**

Add imports at the top of `src/commands/create.ts`:

```typescript
import { getCurrentBranch, branchExists } from "../git.js"
import { getDefaultBranch } from "../state.js"
```

After the existing worktree check (line 58) and before `createWorktree` (line 61), add:

```typescript
let startPoint: string | undefined
const isNewBranch = !branchExists(branch)
if (isNewBranch) {
  const currentBranch = getCurrentBranch()
  const defaultBranch = getDefaultBranch()

  if (currentBranch && currentBranch !== defaultBranch) {
    const startFrom = await select({
      message: `You're on "${currentBranch}". Where should "${branch}" start from?`,
      choices: [
        { name: `Current branch (${currentBranch})`, value: "current" },
        { name: `Default branch (${defaultBranch})`, value: "default" },
      ],
    })

    if (startFrom === "default") {
      startPoint = defaultBranch
    }
  }
}
```

Then pass `startPoint` to `createWorktree`:

```typescript
const worktreePath = createWorktree(branch, startPoint)
```

**Step 2: Verify build compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Manual test**

Run from a non-main branch to verify the prompt appears:
```bash
git checkout -b test-branch
simtree create my-new-feature
# Should see: You're on "test-branch". Where should "my-new-feature" start from?
```

**Step 4: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat: prompt for branch start-point when not on default branch"
```

---

### Task 4: Update move command to use getDefaultBranch

**Files:**
- Modify: `src/commands/move.ts:1-53`

**Step 1: Replace hardcoded branch detection**

In `src/commands/move.ts`:

1. Add import: `import { getDefaultBranch } from "../state.js"`
2. Remove import of `branchExists` from `../git.js` (no longer needed for this purpose)
3. Replace lines 33-53:

```typescript
const defaultBranch = getDefaultBranch()

if (currentBranch === defaultBranch) {
  console.error(`Error: already on "${currentBranch}". Nothing to move.`)
  process.exit(1)
}

const switchTo = defaultBranch
```

This is simpler: we trust the configured default branch rather than probing for `main`/`master`. If the user configured it wrong, `git checkout` will fail with a clear error.

**Step 2: Verify build compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/commands/move.ts
git commit -m "refactor: use getDefaultBranch in move command"
```

---

### Task 5: Final verification

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All pass

**Step 2: Build**

Run: `pnpm build`
Expected: Clean build

**Step 3: Link and manual smoke test**

Run: `pnpm link`

Test scenarios:
1. `simtree create test-1` from main → no prompt, creates normally
2. `git checkout -b feature-x` then `simtree create test-2` → prompt appears
3. Verify `~/.simtree/config.json` can be created manually with `{"defaultBranch": "develop"}` and the prompt shows "develop" instead of "main"

**Step 4: Clean up test branches/worktrees**

```bash
simtree close test-1
simtree close test-2
git checkout main
git branch -D feature-x
```
