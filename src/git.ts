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
