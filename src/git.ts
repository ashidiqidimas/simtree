import { execSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export function getRepoRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim()
  } catch {
    console.error("Error: not inside a git repository.")
    process.exit(1)
  }
}

export function repoNamespace(): string {
  const repoRoot = getMainRepoRoot()
  const repoName = path.basename(repoRoot)
  const shortHash = crypto.createHash("md5").update(repoRoot).digest("hex").slice(0, 4)
  return `${repoName}-${shortHash}`
}

export function getWorktreesDir(): string {
  return path.join(os.homedir(), ".simtree", "worktrees", repoNamespace())
}

export function branchExists(branch: string): boolean {
  try {
    execSync(`git rev-parse --verify "${branch}"`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function createWorktree(branch: string): string {
  const worktreePath = path.join(getWorktreesDir(), branch)
  const useExistingBranch = branchExists(branch)
  const cmd = useExistingBranch
    ? `git worktree add "${worktreePath}" "${branch}"`
    : `git worktree add "${worktreePath}" -b "${branch}"`

  try {
    execSync(cmd, { stdio: "pipe" })
  } catch {
    console.error(`Error: failed to create worktree for branch "${branch}".`)
    process.exit(1)
  }
  return worktreePath
}

export function removeWorktree(branch: string, knownPath?: string): void {
  const worktreePath = knownPath ?? path.join(getWorktreesDir(), branch)
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

export function hasRemoteBranch(branch: string): boolean {
  try {
    const output = execSync(`git ls-remote --heads origin "${branch}"`, {
      encoding: "utf-8",
    })
    return output.trim().length > 0
  } catch {
    return false
  }
}

export function deleteLocalBranch(branch: string): void {
  execSync(`git branch -D "${branch}"`, { stdio: "inherit" })
}

export function deleteRemoteBranch(branch: string): void {
  execSync(`git push origin --delete "${branch}"`, { stdio: "inherit" })
}

export function getCurrentBranch(): string | null {
  try {
    return execSync("git symbolic-ref --short HEAD", { encoding: "utf-8" }).trim()
  } catch {
    return null
  }
}

export function isInsideWorktree(): boolean {
  const toplevel = getRepoRoot()
  const gitPath = path.join(toplevel, ".git")
  return fs.statSync(gitPath).isFile()
}

export function getMainRepoRoot(): string {
  try {
    const gitCommonDir = execSync(
      "git rev-parse --path-format=absolute --git-common-dir",
      { encoding: "utf-8" },
    ).trim()
    return path.dirname(gitCommonDir)
  } catch {
    console.error("Error: not inside a git repository.")
    process.exit(1)
  }
}

export function isWorkingTreeDirty(): boolean {
  return execSync("git status --porcelain", { encoding: "utf-8" }).trim().length > 0
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
