import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getMainRepoRoot,
  getRepoRoot,
  getWorktreesDir,
  repoNamespace,
} from "../../src/git.js"

function createTempRepo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "simtree-test-")))
  execSync("git init && git commit --allow-empty -m 'init'", {
    cwd: dir,
    stdio: "pipe",
  })
  return dir
}

describe("worktree namespace resolution", () => {
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
      } catch {
        // already removed
      }
    }
    worktreePaths.length = 0

    if (mainRepo) {
      fs.rmSync(mainRepo, { recursive: true, force: true })
      mainRepo = undefined!
    }
  })

  it("repoNamespace returns same value from main repo and from worktree", () => {
    mainRepo = createTempRepo()

    const worktreeA = path.join(mainRepo, ".worktrees", "branch-a")
    execSync(`git worktree add "${worktreeA}" -b branch-a`, {
      cwd: mainRepo,
      stdio: "pipe",
    })
    worktreePaths.push(worktreeA)

    process.chdir(mainRepo)
    const namespaceFromMain = repoNamespace()
    const worktreesDirFromMain = getWorktreesDir()

    process.chdir(worktreeA)
    const namespaceFromWorktree = repoNamespace()
    const worktreesDirFromWorktree = getWorktreesDir()

    expect(namespaceFromWorktree).toBe(namespaceFromMain)
    expect(worktreesDirFromWorktree).toBe(worktreesDirFromMain)
  })

  it("getMainRepoRoot returns main repo path even from inside a worktree", () => {
    mainRepo = createTempRepo()

    const worktreeA = path.join(mainRepo, ".worktrees", "branch-a")
    execSync(`git worktree add "${worktreeA}" -b branch-a`, {
      cwd: mainRepo,
      stdio: "pipe",
    })
    worktreePaths.push(worktreeA)

    process.chdir(worktreeA)
    const mainRoot = getMainRepoRoot()

    expect(mainRoot).toBe(mainRepo)
  })

  it("getRepoRoot returns worktree path when inside a worktree", () => {
    mainRepo = createTempRepo()

    const worktreeA = path.join(mainRepo, ".worktrees", "branch-a")
    execSync(`git worktree add "${worktreeA}" -b branch-a`, {
      cwd: mainRepo,
      stdio: "pipe",
    })
    worktreePaths.push(worktreeA)

    process.chdir(worktreeA)
    const repoRoot = getRepoRoot()

    expect(repoRoot).toBe(worktreeA)
  })

  it("repoNamespace is consistent from a nested worktree (worktree created from inside another worktree)", () => {
    mainRepo = createTempRepo()

    const worktreeA = path.join(mainRepo, ".worktrees", "branch-a")
    execSync(`git worktree add "${worktreeA}" -b branch-a`, {
      cwd: mainRepo,
      stdio: "pipe",
    })
    worktreePaths.push(worktreeA)

    // Create worktree B from inside worktree A (the bug scenario)
    const worktreeB = path.join(mainRepo, ".worktrees", "branch-b")
    execSync(`git worktree add "${worktreeB}" -b branch-b`, {
      cwd: worktreeA,
      stdio: "pipe",
    })
    worktreePaths.push(worktreeB)

    process.chdir(mainRepo)
    const fromMain = repoNamespace()

    process.chdir(worktreeA)
    const fromA = repoNamespace()

    process.chdir(worktreeB)
    const fromB = repoNamespace()

    expect(fromA).toBe(fromMain)
    expect(fromB).toBe(fromMain)
  })
})
