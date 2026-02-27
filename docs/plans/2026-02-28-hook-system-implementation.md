# Hook System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add convention-based lifecycle hooks (post-create, post-close) that run shell scripts from `~/.simtree/hooks/`.

**Architecture:** New `src/hooks.ts` module with a single `runHook()` function. The create and close commands call it at the appropriate points. Hook scripts are discovered by convention in `<simtreeDir>/hooks/post-create.sh` and `post-close.sh`. Scripts run via `sh`, receive context as environment variables, and failures produce warnings without aborting the parent command.

**Tech Stack:** Node.js `child_process.execSync`, `fs`, Vitest for tests.

---

### Task 1: Export `getSimtreeDir` from state.ts

**Files:**
- Modify: `src/state.ts:5-7`

**Step 1: Export the existing function**

In `src/state.ts`, change line 5 from:

```typescript
function getSimtreeDir(): string {
```

to:

```typescript
export function getSimtreeDir(): string {
```

**Step 2: Run existing tests to verify nothing breaks**

Run: `pnpm test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/state.ts
git commit -m "refactor: export getSimtreeDir from state module"
```

---

### Task 2: Create hooks module with tests

**Files:**
- Create: `src/hooks.ts`
- Create: `test/unit/hooks.test.ts`

**Step 1: Write the failing tests**

Create `test/unit/hooks.test.ts`:

```typescript
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runHook } from "../../src/hooks.js"

describe("runHook", () => {
  let tempDir: string
  let originalHome: string | undefined

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "simtree-hooks-test-"))
    )
    originalHome = process.env.SIMTREE_HOME
    process.env.SIMTREE_HOME = tempDir
  })

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.SIMTREE_HOME
    } else {
      process.env.SIMTREE_HOME = originalHome
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it("silently skips when hook file does not exist", () => {
    expect(() => {
      runHook("post-create", {}, tempDir)
    }).not.toThrow()
  })

  it("runs the hook script and passes environment variables", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })

    const markerFile = path.join(tempDir, "hook-ran.txt")
    fs.writeFileSync(
      path.join(hooksDir, "post-create.sh"),
      `echo "$SIMTREE_BRANCH" > "${markerFile}"`
    )

    runHook("post-create", { SIMTREE_BRANCH: "feat/test" }, tempDir)

    expect(fs.existsSync(markerFile)).toBe(true)
    expect(fs.readFileSync(markerFile, "utf-8").trim()).toBe("feat/test")
  })

  it("runs the hook with the specified working directory", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })

    const markerFile = path.join(tempDir, "cwd.txt")
    fs.writeFileSync(
      path.join(hooksDir, "post-create.sh"),
      `pwd > "${markerFile}"`
    )

    runHook("post-create", {}, tempDir)

    expect(fs.readFileSync(markerFile, "utf-8").trim()).toBe(tempDir)
  })

  it("does not throw when hook script fails", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })
    fs.writeFileSync(path.join(hooksDir, "post-create.sh"), "exit 1")

    expect(() => {
      runHook("post-create", {}, tempDir)
    }).not.toThrow()
  })

  it("prints a warning when hook script fails", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })
    fs.writeFileSync(
      path.join(hooksDir, "post-create.sh"),
      'echo "something broke" >&2\nexit 1'
    )

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(" "))
    }

    runHook("post-create", {}, tempDir)

    console.warn = originalWarn
    expect(warnings.some((w) => w.includes("post-create"))).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../../src/hooks.js`

**Step 3: Write minimal implementation**

Create `src/hooks.ts`:

```typescript
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { getSimtreeDir } from "./state.js"

export function runHook(
  hookName: string,
  env: Record<string, string>,
  cwd: string
): void {
  const hookPath = path.join(getSimtreeDir(), "hooks", `${hookName}.sh`)

  if (!fs.existsSync(hookPath)) return

  console.log(`Running ${hookName} hook...`)

  try {
    execSync(`sh "${hookPath}"`, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "pipe",
    })
  } catch (error: unknown) {
    const execError = error as { stderr?: Buffer; status?: number }
    const stderr = execError.stderr?.toString().trim() ?? ""
    const code = execError.status ?? 1
    console.warn(
      `Warning: ${hookName} hook failed (exit code ${code})${stderr ? `:\n${stderr}` : ""}`
    )
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/hooks.ts test/unit/hooks.test.ts
git commit -m "feat: add hooks module with runHook function"
```

---

### Task 3: Integrate post-create hook into create command

**Files:**
- Modify: `src/commands/create.ts`

**Step 1: Add import**

Add to the imports in `src/commands/create.ts`:

```typescript
import { runHook } from "../hooks.js"
```

**Step 2: Call runHook after config generation, before "open in editor" prompt**

After line 92 (`generateConfig(repoRoot, worktreePath, simulator)`) and before line 93 (`console.log(\`\nWorktree ready: ${worktreePath}\`)`), insert:

```typescript
    runHook("post-create", {
      SIMTREE_BRANCH: branch,
      SIMTREE_WORKTREE_PATH: worktreePath,
      SIMTREE_REPO_ROOT: repoRoot,
      SIMTREE_SIMULATOR_UDID: simulator.udid,
      SIMTREE_SIMULATOR_NAME: simulator.name,
    }, worktreePath)
```

**Step 3: Run tests to verify nothing breaks**

Run: `pnpm test`
Expected: All tests pass.

**Step 4: Build to verify compilation**

Run: `pnpm build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat: add post-create hook to create command"
```

---

### Task 4: Integrate post-close hook into close command

**Files:**
- Modify: `src/commands/close.ts`

**Step 1: Add imports**

Add to the imports in `src/commands/close.ts`:

```typescript
import { getRepoRoot } from "../git.js"
```

Update the existing git import to include `getRepoRoot` (it already imports from `../git.js`, so add `getRepoRoot` to that import).

Also add:

```typescript
import { runHook } from "../hooks.js"
```

**Step 2: Call runHook after simulator unlock, before branch deletion prompt**

After line 46 (`console.log(\`Simulator unlocked for: ${worktreePath}\`)`) and before line 48 (`const hasRemote = hasRemoteBranch(branch)`), insert:

```typescript
    const repoRoot = getRepoRoot()
    runHook("post-close", {
      SIMTREE_BRANCH: branch,
      SIMTREE_WORKTREE_PATH: worktreePath,
      SIMTREE_REPO_ROOT: repoRoot,
    }, repoRoot)
```

**Step 3: Run tests to verify nothing breaks**

Run: `pnpm test`
Expected: All tests pass.

**Step 4: Build to verify compilation**

Run: `pnpm build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/commands/close.ts
git commit -m "feat: add post-close hook to close command"
```

---

### Task 5: Manual smoke test

**Step 1: Create a test hook**

```bash
mkdir -p ~/.simtree/hooks
echo 'echo "post-create hook ran for branch: $SIMTREE_BRANCH in $SIMTREE_WORKTREE_PATH"' > ~/.simtree/hooks/post-create.sh
```

**Step 2: Run `simtree create test-hooks` and verify hook output appears**

**Step 3: Clean up**

```bash
simtree close test-hooks
rm ~/.simtree/hooks/post-create.sh
```
