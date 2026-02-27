import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createWorktree } from "../../src/git.js"

function createTempRepo(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "simtree-test-")))
  execSync("git init && git commit --allow-empty -m 'init'", {
    cwd: dir,
    stdio: "pipe",
  })
  return dir
}

function getHead(cwd: string): string {
  return execSync("git rev-parse HEAD", { cwd, encoding: "utf-8" }).trim()
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

  it("creates a worktree at the start-point commit, not at HEAD", () => {
    mainRepo = createTempRepo()
    process.chdir(mainRepo)

    // Make a second commit on main so we have a known HEAD
    execSync("git commit --allow-empty -m 'second commit on main'", {
      cwd: mainRepo,
      stdio: "pipe",
    })
    const mainHead = getHead(mainRepo)

    // Create a feature branch with an extra commit
    execSync("git checkout -b feature", { cwd: mainRepo, stdio: "pipe" })
    execSync("git commit --allow-empty -m 'feature commit'", {
      cwd: mainRepo,
      stdio: "pipe",
    })
    const featureHead = getHead(mainRepo)

    // Sanity check: feature is ahead of main
    expect(featureHead).not.toBe(mainHead)

    // From feature branch, create a worktree for a new branch starting from main
    const wtPath = createWorktree("new-branch", "main")
    worktreePaths.push(wtPath)

    const worktreeHead = getHead(wtPath)
    expect(worktreeHead).toBe(mainHead)
  })
})
