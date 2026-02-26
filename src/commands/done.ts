import { execSync } from "node:child_process"
import { Command } from "commander"
import { select } from "@inquirer/prompts"
import {
  getRepoRoot,
  getMainRepoRoot,
  isInsideWorktree,
  getCurrentBranch,
  removeWorktree,
  hasRemoteBranch,
  deleteLocalBranch,
  deleteRemoteBranch,
} from "../git.js"
import { unlockByWorktree } from "../state.js"

export const doneCommand = new Command("done")
  .description("Close current worktree and open the main directory in $EDITOR")
  .action(async () => {
    if (!isInsideWorktree()) {
      console.error(
        "Error: not inside a worktree. Use 'simtree close' from the main repo instead.",
      )
      process.exit(1)
    }

    const branch = getCurrentBranch()
    if (!branch) {
      console.error("Error: could not determine current branch (detached HEAD?).")
      process.exit(1)
    }

    const worktreePath = getRepoRoot()
    const mainRepoRoot = getMainRepoRoot()

    process.chdir(mainRepoRoot)

    console.log(`Closing worktree "${branch}"...`)
    removeWorktree(branch)

    unlockByWorktree(worktreePath)
    console.log(`Simulator unlocked for: ${worktreePath}`)

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

    const editor = process.env.EDITOR
    if (editor) {
      console.log(`Opening main directory in ${editor}...`)
      execSync(`${editor} "${mainRepoRoot}"`, { stdio: "inherit" })
    } else {
      console.log(`No $EDITOR set. Main repo is at: ${mainRepoRoot}`)
    }
  })
