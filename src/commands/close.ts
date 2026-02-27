import path from "node:path"
import { Command } from "commander"
import { select } from "@inquirer/prompts"
import {
  getRepoRoot,
  getWorktreesDir,
  removeWorktree,
  listWorktrees,
  hasRemoteBranch,
  deleteLocalBranch,
  deleteRemoteBranch,
} from "../git.js"
import { runHook } from "../hooks.js"
import { unlockByWorktree } from "../state.js"

export const closeCommand = new Command("close")
  .description("Remove a worktree and unlock its simulator")
  .argument("[branch]", "Branch name of the worktree to close")
  .action(async (branch?: string) => {
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

    const repoRoot = getRepoRoot()
    runHook("post-close", {
      SIMTREE_BRANCH: branch,
      SIMTREE_WORKTREE_PATH: worktreePath,
      SIMTREE_REPO_ROOT: repoRoot,
    }, repoRoot)

    const hasRemote = hasRemoteBranch(branch)

    const choices: { name: string; value: string }[] = [
      { name: "No, keep the branch", value: "keep" },
      { name: "Delete local branch", value: "local" },
    ]

    if (hasRemote) {
      choices.push({
        name: "Delete local and remote branch",
        value: "both",
      })
    }

    const deleteChoice = await select({
      message: `Delete branch "${branch}"?`,
      choices,
    })

    if (deleteChoice === "local" || deleteChoice === "both") {
      deleteLocalBranch(branch)
      console.log(`Deleted local branch "${branch}"`)
    }

    if (deleteChoice === "both") {
      deleteRemoteBranch(branch)
      console.log(`Deleted remote branch "${branch}"`)
    }
  })
