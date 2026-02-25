# simtree Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript CLI tool (`simtree`) that manages git worktrees with automatic iOS simulator assignment and xcodebuildmcp config generation.

**Architecture:** A single CLI binary built with `commander` for command parsing, `@inquirer/prompts` for interactive selection, and flat JSON files in `~/.simtree/` for global state. Per-repo config lives in `.simtree` JSON file. All worktrees are created under `<repo>/.worktrees/`.

**Tech Stack:** TypeScript, Node.js, commander, @inquirer/prompts, tsup, pnpm

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `src/index.ts`
- Create: `.gitignore`

**Step 1: Initialize pnpm project**

Run: `pnpm init`

**Step 2: Install dependencies**

Run: `pnpm add commander @inquirer/prompts yaml`
Run: `pnpm add -D typescript tsup @types/node`

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create tsup.config.ts**

```ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
})
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.DS_Store
```

**Step 6: Create src/index.ts with minimal entry point**

```ts
import { program } from "commander"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.parse()
```

**Step 7: Update package.json**

Add to `package.json`:
```json
{
  "type": "module",
  "bin": {
    "simtree": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "link": "pnpm build && pnpm link --global"
  }
}
```

**Step 8: Build and verify**

Run: `pnpm build`
Expected: `dist/index.js` created with shebang line

Run: `node dist/index.js --help`
Expected: Shows help text with "Manage git worktrees with automatic iOS simulator assignment"

**Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsup.config.ts src/index.ts .gitignore
git commit -m "feat: scaffold simtree project with TypeScript + commander"
```

---

### Task 2: Global State Module (`~/.simtree/`)

**Files:**
- Create: `src/state.ts`

**Step 1: Create src/state.ts**

This module manages reading/writing the global `~/.simtree/` files: `simulators.json` and `locks.json`.

```ts
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const SIMTREE_DIR = path.join(os.homedir(), ".simtree")
const SIMULATORS_FILE = path.join(SIMTREE_DIR, "simulators.json")
const LOCKS_FILE = path.join(SIMTREE_DIR, "locks.json")

export const CONFIG_TEMPLATE_FILE = path.join(SIMTREE_DIR, "config-template.yaml")

export interface Simulator {
  udid: string
  name: string
}

export interface Lock {
  udid: string
  worktreePath: string
  lockedAt: string
}

function ensureDir(): void {
  if (!fs.existsSync(SIMTREE_DIR)) {
    fs.mkdirSync(SIMTREE_DIR, { recursive: true })
  }
}

export function readSimulators(): Simulator[] {
  if (!fs.existsSync(SIMULATORS_FILE)) return []
  const raw = fs.readFileSync(SIMULATORS_FILE, "utf-8")
  return JSON.parse(raw)
}

export function writeSimulators(simulators: Simulator[]): void {
  ensureDir()
  fs.writeFileSync(SIMULATORS_FILE, JSON.stringify(simulators, null, 2) + "\n")
}

export function readLocks(): Lock[] {
  if (!fs.existsSync(LOCKS_FILE)) return []
  const raw = fs.readFileSync(LOCKS_FILE, "utf-8")
  return JSON.parse(raw)
}

export function writeLocks(locks: Lock[]): void {
  ensureDir()
  fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 2) + "\n")
}

export function pruneStaleLocks(): Lock[] {
  const locks = readLocks()
  const valid = locks.filter((lock) => fs.existsSync(lock.worktreePath))
  if (valid.length !== locks.length) {
    writeLocks(valid)
  }
  return valid
}

export function lockSimulator(udid: string, worktreePath: string): void {
  const locks = pruneStaleLocks()
  const existing = locks.find((l) => l.udid === udid)
  if (existing) {
    existing.worktreePath = worktreePath
    existing.lockedAt = new Date().toISOString()
  } else {
    locks.push({ udid, worktreePath, lockedAt: new Date().toISOString() })
  }
  writeLocks(locks)
}

export function unlockByWorktree(worktreePath: string): void {
  const locks = readLocks()
  const filtered = locks.filter((l) => l.worktreePath !== worktreePath)
  writeLocks(filtered)
}
```

**Step 2: Build and verify no compile errors**

Run: `pnpm build`
Expected: Builds without errors

**Step 3: Commit**

```bash
git add src/state.ts
git commit -m "feat: add global state module for simulators and locks"
```

---

### Task 3: Git Utilities Module

**Files:**
- Create: `src/git.ts`

**Step 1: Create src/git.ts**

Utilities for git operations: detecting repo root, creating/removing worktrees, listing worktrees.

```ts
import { execSync } from "node:child_process"
import path from "node:path"

export function getRepoRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim()
  } catch {
    console.error("Error: not inside a git repository.")
    process.exit(1)
  }
}

export function getWorktreesDir(): string {
  return path.join(getRepoRoot(), ".worktrees")
}

export function createWorktree(branch: string): string {
  const worktreePath = path.join(getWorktreesDir(), branch)
  try {
    execSync(`git worktree add "${worktreePath}" -b "${branch}"`, {
      stdio: "inherit",
    })
  } catch {
    // Branch might already exist, try without -b
    try {
      execSync(`git worktree add "${worktreePath}" "${branch}"`, {
        stdio: "inherit",
      })
    } catch (e) {
      console.error(`Error: failed to create worktree for branch "${branch}".`)
      process.exit(1)
    }
  }
  return worktreePath
}

export function removeWorktree(branch: string): void {
  const worktreePath = path.join(getWorktreesDir(), branch)
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      stdio: "inherit",
    })
  } catch {
    console.error(`Error: failed to remove worktree at "${worktreePath}".`)
    process.exit(1)
  }
}

export interface WorktreeInfo {
  path: string
  branch: string
  head: string
  bare: boolean
}

export function listWorktrees(): WorktreeInfo[] {
  const output = execSync("git worktree list --porcelain", { encoding: "utf-8" })
  const entries: WorktreeInfo[] = []
  let current: Partial<WorktreeInfo> = {}

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length)
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length)
    } else if (line.startsWith("branch ")) {
      const fullRef = line.slice("branch ".length)
      current.branch = fullRef.replace("refs/heads/", "")
    } else if (line === "bare") {
      current.bare = true
    } else if (line === "") {
      if (current.path) {
        entries.push({
          path: current.path,
          branch: current.branch ?? "(detached)",
          head: current.head ?? "",
          bare: current.bare ?? false,
        })
      }
      current = {}
    }
  }

  return entries
}
```

**Step 2: Build and verify no compile errors**

Run: `pnpm build`
Expected: Builds without errors

**Step 3: Commit**

```bash
git add src/git.ts
git commit -m "feat: add git utilities for worktree operations"
```

---

### Task 4: Simulator Resolution Module

**Files:**
- Create: `src/simulator.ts`

**Step 1: Create src/simulator.ts**

Resolves simulator name from UDID via `xcrun simctl list`, and handles finding/assigning simulators.

```ts
import { execSync } from "node:child_process"
import { select } from "@inquirer/prompts"
import { readSimulators, readLocks, pruneStaleLocks, lockSimulator } from "./state.js"
import type { Simulator } from "./state.js"

export function resolveSimulatorName(udid: string): string {
  try {
    const output = execSync("xcrun simctl list devices available --json", {
      encoding: "utf-8",
    })
    const data = JSON.parse(output)
    for (const runtime of Object.values(data.devices) as Array<Array<{ udid: string; name: string }>>) {
      for (const device of runtime) {
        if (device.udid === udid) {
          return device.name
        }
      }
    }
  } catch {
    // Fall through
  }
  console.error(`Error: could not resolve simulator name for UDID "${udid}".`)
  process.exit(1)
}

export async function assignSimulator(worktreePath: string): Promise<Simulator> {
  const simulators = readSimulators()
  if (simulators.length === 0) {
    console.error("Error: no simulators in pool. Run `simtree sim add <udid>` first.")
    process.exit(1)
  }

  const locks = pruneStaleLocks()
  const lockedUdids = new Set(locks.map((l) => l.udid))
  const unlocked = simulators.filter((s) => !lockedUdids.has(s.udid))

  let chosen: Simulator

  if (unlocked.length > 0) {
    chosen = unlocked[0]
    console.log(`Assigned simulator: ${chosen.name} (${chosen.udid})`)
  } else {
    console.log("All simulators are locked. Choose one to force-assign:")
    const answer = await select({
      message: "Select a simulator:",
      choices: simulators.map((s) => {
        const lock = locks.find((l) => l.udid === s.udid)
        const lockInfo = lock ? ` [locked by ${lock.worktreePath}]` : ""
        return {
          name: `${s.name} (${s.udid})${lockInfo}`,
          value: s.udid,
        }
      }),
    })
    chosen = simulators.find((s) => s.udid === answer)!
    console.log(`Force-assigned simulator: ${chosen.name} (${chosen.udid})`)
  }

  lockSimulator(chosen.udid, worktreePath)
  return chosen
}
```

**Step 2: Build and verify no compile errors**

Run: `pnpm build`
Expected: Builds without errors

**Step 3: Commit**

```bash
git add src/simulator.ts
git commit -m "feat: add simulator resolution and assignment module"
```

---

### Task 5: Config Generation Module

**Files:**
- Create: `src/config.ts`

**Step 1: Create src/config.ts**

Reads a template xcodebuildmcp config, replaces simulator and path fields, writes to worktree.

```ts
import fs from "node:fs"
import path from "node:path"
import { parse, stringify } from "yaml"
import { CONFIG_TEMPLATE_FILE } from "./state.js"
import type { Simulator } from "./state.js"

interface XcodeBuildConfig {
  schemaVersion: number
  enabledWorkflows: string[]
  sessionDefaults: {
    workspacePath: string
    scheme: string
    configuration: string
    simulatorName: string
    simulatorId: string
    simulatorPlatform: string
    derivedDataPath: string
    platform: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function findTemplate(repoRoot: string): string | null {
  const repoConfig = path.join(repoRoot, ".xcodebuildmcp", "config.yaml")
  if (fs.existsSync(repoConfig)) return repoConfig

  if (fs.existsSync(CONFIG_TEMPLATE_FILE)) return CONFIG_TEMPLATE_FILE

  return null
}

export function generateConfig(
  repoRoot: string,
  worktreePath: string,
  simulator: Simulator,
): void {
  const templatePath = findTemplate(repoRoot)
  if (!templatePath) {
    console.error(
      "Error: no xcodebuildmcp config template found.\n" +
        `  Expected at: ${repoRoot}/.xcodebuildmcp/config.yaml\n` +
        `  Or global:   ${CONFIG_TEMPLATE_FILE}`,
    )
    process.exit(1)
  }

  const raw = fs.readFileSync(templatePath, "utf-8")
  const config: XcodeBuildConfig = parse(raw)

  // Rewrite simulator fields
  config.sessionDefaults.simulatorId = simulator.udid
  config.sessionDefaults.simulatorName = simulator.name

  // Rewrite workspace path: replace repo root with worktree path
  const oldWorkspace = config.sessionDefaults.workspacePath
  if (oldWorkspace) {
    const workspaceRelative = path.basename(oldWorkspace)
    config.sessionDefaults.workspacePath = path.join(worktreePath, workspaceRelative)
  }

  // Rewrite derived data path
  config.sessionDefaults.derivedDataPath = path.join(
    worktreePath,
    ".xcodebuildmcp",
    ".derivedData",
  )

  // Write config
  const outputDir = path.join(worktreePath, ".xcodebuildmcp")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, "config.yaml")
  fs.writeFileSync(outputPath, stringify(config))
  console.log(`Written config: ${outputPath}`)
}
```

**Step 2: Build and verify no compile errors**

Run: `pnpm build`
Expected: Builds without errors

**Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add xcodebuildmcp config generation module"
```

---

### Task 6: File Copy Module

**Files:**
- Create: `src/copy.ts`

**Step 1: Create src/copy.ts**

Reads `.simtree` config from repo root and copies listed files into the worktree.

```ts
import fs from "node:fs"
import path from "node:path"

interface SimtreeConfig {
  copyFiles: string[]
}

function readSimtreeConfig(repoRoot: string): SimtreeConfig {
  const configPath = path.join(repoRoot, ".simtree")
  if (!fs.existsSync(configPath)) {
    return { copyFiles: [] }
  }
  const raw = fs.readFileSync(configPath, "utf-8")
  return JSON.parse(raw)
}

export function copyFiles(repoRoot: string, worktreePath: string): void {
  const config = readSimtreeConfig(repoRoot)
  if (config.copyFiles.length === 0) return

  for (const file of config.copyFiles) {
    const src = path.join(repoRoot, file)
    const dest = path.join(worktreePath, file)

    if (!fs.existsSync(src)) {
      console.log(`  Skip (not found): ${file}`)
      continue
    }

    const destDir = path.dirname(dest)
    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(src, dest)
    console.log(`  Copied: ${file}`)
  }
}
```

**Step 2: Build and verify no compile errors**

Run: `pnpm build`
Expected: Builds without errors

**Step 3: Commit**

```bash
git add src/copy.ts
git commit -m "feat: add file copy module for gitignored files"
```

---

### Task 7: `simtree sim` Commands

**Files:**
- Create: `src/commands/sim.ts`
- Modify: `src/index.ts`

**Step 1: Create src/commands/sim.ts**

```ts
import { Command } from "commander"
import { readSimulators, writeSimulators, readLocks, pruneStaleLocks } from "../state.js"
import { resolveSimulatorName } from "../simulator.js"

export const simCommand = new Command("sim")
  .description("Manage simulator pool")

simCommand
  .command("add <udid>")
  .description("Add a simulator to the pool")
  .action((udid: string) => {
    const simulators = readSimulators()
    if (simulators.some((s) => s.udid === udid)) {
      console.error(`Simulator ${udid} is already in the pool.`)
      process.exit(1)
    }
    const name = resolveSimulatorName(udid)
    simulators.push({ udid, name })
    writeSimulators(simulators)
    console.log(`Added: ${name} (${udid})`)
  })

simCommand
  .command("remove <udid>")
  .description("Remove a simulator from the pool")
  .action((udid: string) => {
    const simulators = readSimulators()
    const filtered = simulators.filter((s) => s.udid !== udid)
    if (filtered.length === simulators.length) {
      console.error(`Simulator ${udid} is not in the pool.`)
      process.exit(1)
    }
    writeSimulators(filtered)
    console.log(`Removed: ${udid}`)
  })

simCommand
  .command("list")
  .description("Show all simulators and their lock status")
  .action(() => {
    const simulators = readSimulators()
    const locks = readLocks()

    if (simulators.length === 0) {
      console.log("No simulators in pool. Run `simtree sim add <udid>` to add one.")
      return
    }

    for (const sim of simulators) {
      const lock = locks.find((l) => l.udid === sim.udid)
      const status = lock ? `LOCKED (${lock.worktreePath})` : "available"
      console.log(`  ${sim.name} (${sim.udid}) — ${status}`)
    }
  })

simCommand
  .command("prune")
  .description("Unlock simulators whose worktree no longer exists")
  .action(() => {
    const before = readLocks().length
    const after = pruneStaleLocks().length
    const pruned = before - after
    if (pruned > 0) {
      console.log(`Pruned ${pruned} stale lock(s).`)
    } else {
      console.log("No stale locks found.")
    }
  })
```

**Step 2: Update src/index.ts to register sim command**

```ts
import { program } from "commander"
import { simCommand } from "./commands/sim.js"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.addCommand(simCommand)

program.parse()
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Builds without errors

Run: `node dist/index.js sim --help`
Expected: Shows sim subcommands (add, remove, list, prune)

**Step 4: Commit**

```bash
git add src/commands/sim.ts src/index.ts
git commit -m "feat: add simtree sim commands (add, remove, list, prune)"
```

---

### Task 8: `simtree create` Command

**Files:**
- Create: `src/commands/create.ts`
- Modify: `src/index.ts`

**Step 1: Create src/commands/create.ts**

```ts
import fs from "node:fs"
import { Command } from "commander"
import { getRepoRoot, getWorktreesDir, createWorktree } from "../git.js"
import { assignSimulator } from "../simulator.js"
import { generateConfig } from "../config.js"
import { copyFiles } from "../copy.js"

export const createCommand = new Command("create")
  .description("Create a worktree with automatic simulator assignment")
  .argument("<branch>", "Branch name for the worktree")
  .action(async (branch: string) => {
    const repoRoot = getRepoRoot()
    const worktreesDir = getWorktreesDir()

    // Ensure .worktrees dir exists
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true })
    }

    // Create worktree
    console.log(`Creating worktree for branch "${branch}"...`)
    const worktreePath = createWorktree(branch)

    // Copy gitignored files
    console.log("Copying files...")
    copyFiles(repoRoot, worktreePath)

    // Assign simulator
    const simulator = await assignSimulator(worktreePath)

    // Generate xcodebuildmcp config
    generateConfig(repoRoot, worktreePath, simulator)

    console.log(`\nWorktree ready: ${worktreePath}`)
    console.log(`Simulator: ${simulator.name} (${simulator.udid})`)
  })
```

**Step 2: Update src/index.ts**

```ts
import { program } from "commander"
import { simCommand } from "./commands/sim.js"
import { createCommand } from "./commands/create.js"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.addCommand(simCommand)
program.addCommand(createCommand)

program.parse()
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Builds without errors

Run: `node dist/index.js create --help`
Expected: Shows create command help

**Step 4: Commit**

```bash
git add src/commands/create.ts src/index.ts
git commit -m "feat: add simtree create command"
```

---

### Task 9: `simtree close` Command

**Files:**
- Create: `src/commands/close.ts`
- Modify: `src/index.ts`

**Step 1: Create src/commands/close.ts**

```ts
import path from "node:path"
import { Command } from "commander"
import { select } from "@inquirer/prompts"
import { getRepoRoot, getWorktreesDir, removeWorktree, listWorktrees } from "../git.js"
import { unlockByWorktree } from "../state.js"

export const closeCommand = new Command("close")
  .description("Remove a worktree and unlock its simulator")
  .argument("[branch]", "Branch name of the worktree to close")
  .action(async (branch?: string) => {
    const repoRoot = getRepoRoot()
    const worktreesDir = getWorktreesDir()

    if (!branch) {
      // Interactive: list worktrees under .worktrees/ and let user pick
      const worktrees = listWorktrees().filter((wt) =>
        wt.path.startsWith(worktreesDir)
      )

      if (worktrees.length === 0) {
        console.log("No active worktrees to close.")
        return
      }

      const answer = await select({
        message: "Select worktree to close:",
        choices: worktrees.map((wt) => ({
          name: `${wt.branch} (${wt.path})`,
          value: wt.branch,
        })),
      })
      branch = answer
    }

    const worktreePath = path.join(worktreesDir, branch)

    console.log(`Closing worktree "${branch}"...`)
    removeWorktree(branch)

    unlockByWorktree(worktreePath)
    console.log(`Simulator unlocked for: ${worktreePath}`)
  })
```

**Step 2: Update src/index.ts**

```ts
import { program } from "commander"
import { simCommand } from "./commands/sim.js"
import { createCommand } from "./commands/create.js"
import { closeCommand } from "./commands/close.js"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.addCommand(simCommand)
program.addCommand(createCommand)
program.addCommand(closeCommand)

program.parse()
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Builds without errors

Run: `node dist/index.js close --help`
Expected: Shows close command help

**Step 4: Commit**

```bash
git add src/commands/close.ts src/index.ts
git commit -m "feat: add simtree close command"
```

---

### Task 10: `simtree list` Command

**Files:**
- Create: `src/commands/list.ts`
- Modify: `src/index.ts`

**Step 1: Create src/commands/list.ts**

```ts
import { Command } from "commander"
import { getWorktreesDir, listWorktrees } from "../git.js"
import { readLocks, readSimulators } from "../state.js"

export const listCommand = new Command("list")
  .description("List active worktrees with their assigned simulators")
  .action(() => {
    const worktreesDir = getWorktreesDir()
    const worktrees = listWorktrees().filter((wt) =>
      wt.path.startsWith(worktreesDir)
    )

    if (worktrees.length === 0) {
      console.log("No active worktrees.")
      return
    }

    const locks = readLocks()
    const simulators = readSimulators()

    for (const wt of worktrees) {
      const lock = locks.find((l) => l.worktreePath === wt.path)
      let simInfo = "no simulator"
      if (lock) {
        const sim = simulators.find((s) => s.udid === lock.udid)
        simInfo = sim ? `${sim.name} (${sim.udid})` : lock.udid
      }
      console.log(`  ${wt.branch} — ${simInfo}`)
      console.log(`    ${wt.path}`)
    }
  })
```

**Step 2: Update src/index.ts**

```ts
import { program } from "commander"
import { simCommand } from "./commands/sim.js"
import { createCommand } from "./commands/create.js"
import { closeCommand } from "./commands/close.js"
import { listCommand } from "./commands/list.js"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.addCommand(simCommand)
program.addCommand(createCommand)
program.addCommand(closeCommand)
program.addCommand(listCommand)

program.parse()
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Builds without errors

Run: `node dist/index.js list --help`
Expected: Shows list command help

**Step 4: Commit**

```bash
git add src/commands/list.ts src/index.ts
git commit -m "feat: add simtree list command"
```

---

### Task 11: Link Globally and End-to-End Test

**Files:**
- No new files

**Step 1: Link simtree globally**

Run: `pnpm link --global`
Expected: `simtree` command now available globally

**Step 2: Verify all commands**

Run: `simtree --help`
Expected: Shows all commands (create, close, list, sim)

Run: `simtree sim --help`
Expected: Shows sim subcommands

**Step 3: Manual end-to-end test**

Test in the sherlock-ios repo or a test repo:

```bash
# Add simulators to pool
simtree sim add B88EAB53-3D54-4D38-BA7B-BBB5FA5A2299
simtree sim add D2138101-9467-42C7-B488-E7E6C5713E2D

# Verify pool
simtree sim list

# Create a worktree
cd /path/to/test-repo
simtree create test-branch

# Verify
simtree list
cat .worktrees/test-branch/.xcodebuildmcp/config.yaml

# Close
simtree close test-branch

# Verify cleanup
simtree list
simtree sim list
```

**Step 4: Commit (if any fixes needed)**

```bash
git commit -m "fix: address issues found during e2e testing"
```
