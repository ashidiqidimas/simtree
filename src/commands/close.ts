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
