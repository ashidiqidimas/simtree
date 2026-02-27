import { execSync } from "node:child_process"
import fs from "node:fs"
import { Command } from "commander"
import { confirm, select } from "@inquirer/prompts"
import {
  getRepoRoot,
  getWorktreesDir,
  createWorktree,
  removeWorktree,
  listWorktrees,
  getCurrentBranch,
  branchExists,
} from "../git.js"
import { assignSimulator } from "../simulator.js"
import { generateConfig } from "../config.js"
import { copyFiles } from "../copy.js"
import { unlockByWorktree, getDefaultBranch } from "../state.js"

export const createCommand = new Command("create")
  .description("Create a worktree with automatic simulator assignment")
  .argument("<branch>", "Branch name for the worktree")
  .action(async (branch: string) => {
    const repoRoot = getRepoRoot()
    const worktreesDir = getWorktreesDir()

    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true })
    }

    const existingWorktree = listWorktrees().find(
      (wt) => wt.branch === branch
    )
    if (existingWorktree) {
      const action = await select({
        message: `Branch "${branch}" already has a worktree at ${existingWorktree.path}`,
        choices: [
          { name: "Open existing worktree", value: "open" },
          { name: "Overwrite (remove and recreate)", value: "overwrite" },
          { name: "Cancel", value: "cancel" },
        ],
      })

      if (action === "cancel") {
        return
      }

      if (action === "open") {
        const editor = process.env.EDITOR
        if (editor) {
          execSync(`${editor} ${existingWorktree.path}`, { stdio: "inherit" })
        } else {
          console.log(`Worktree path: ${existingWorktree.path}`)
        }
        return
      }

      console.log(`Removing existing worktree "${branch}"...`)
      unlockByWorktree(existingWorktree.path)
      removeWorktree(branch)
    }

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

    console.log(`Creating worktree for branch "${branch}"...`)
    const worktreePath = createWorktree(branch, startPoint)

    console.log("Copying files...")
    copyFiles(repoRoot, worktreePath)

    const simulator = await assignSimulator(worktreePath)

    generateConfig(repoRoot, worktreePath, simulator)

    console.log(`\nWorktree ready: ${worktreePath}`)
    console.log(`Simulator: ${simulator.name} (${simulator.udid})`)

    const editor = process.env.EDITOR
    if (editor) {
      const shouldOpen = await confirm({
        message: `Open worktree with ${editor}?`,
      })
      if (shouldOpen) {
        execSync(`${editor} ${worktreePath}`, { stdio: "inherit" })
      }
    }
  })
