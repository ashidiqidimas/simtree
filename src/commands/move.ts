import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Command } from "commander"
import { confirm, input } from "@inquirer/prompts"
import {
  getRepoRoot,
  getWorktreesDir,
  listWorktrees,
  getCurrentBranch,
  isInsideWorktree,
  isWorkingTreeDirty,
} from "../git.js"
import { getDefaultBranch } from "../state.js"
import { assignSimulator } from "../simulator.js"
import { generateConfig } from "../config.js"
import { copyFiles } from "../copy.js"

export const moveCommand = new Command("move")
  .description("Move current branch to a worktree")
  .action(async () => {
    if (isInsideWorktree()) {
      console.error("Error: already inside a worktree. Run this from the main repository.")
      process.exit(1)
    }

    const currentBranch = getCurrentBranch()
    if (!currentBranch) {
      console.error("Error: HEAD is detached. Checkout a branch first.")
      process.exit(1)
    }

    const defaultBranch = getDefaultBranch()

    if (currentBranch === defaultBranch) {
      console.error(`Error: already on "${currentBranch}". Nothing to move.`)
      process.exit(1)
    }

    const switchTo = defaultBranch

    const dirty = isWorkingTreeDirty()
    let moveChanges = false
    if (dirty) {
      moveChanges = await confirm({
        message: "You have uncommitted changes. Move them to the worktree?",
      })
    }

    let worktreeName = currentBranch
    const worktreesDir = getWorktreesDir()
    const existingWorktrees = listWorktrees()

    if (existingWorktrees.some((wt) => wt.path === path.join(worktreesDir, worktreeName))) {
      console.log(`A worktree directory "${worktreeName}" already exists.`)
      worktreeName = await input({
        message: "Enter a different name for the worktree directory:",
      })
      if (!worktreeName.trim()) {
        console.error("Error: name cannot be empty.")
        process.exit(1)
      }
    }

    if (dirty) {
      console.log("Stashing uncommitted changes...")
      execSync("git stash", { stdio: "inherit" })
    }

    console.log(`Switching to "${switchTo}"...`)
    try {
      execSync(`git checkout "${switchTo}"`, { stdio: "inherit" })
    } catch {
      if (dirty) {
        console.log("Restoring stashed changes...")
        execSync("git stash pop", { stdio: "inherit" })
      }
      console.error(`Error: failed to switch to "${switchTo}".`)
      process.exit(1)
    }

    const repoRoot = getRepoRoot()
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true })
    }

    console.log(`Creating worktree for branch "${currentBranch}"...`)
    const worktreePath = path.join(worktreesDir, worktreeName)
    try {
      execSync(`git worktree add "${worktreePath}" "${currentBranch}"`, { stdio: "pipe" })
    } catch {
      console.error(`Error: failed to create worktree for branch "${currentBranch}".`)
      if (dirty) {
        console.log("Your changes are still in the stash. Use 'git stash pop' to restore them.")
      }
      process.exit(1)
    }

    console.log("Copying files...")
    copyFiles(repoRoot, worktreePath)

    if (dirty && moveChanges) {
      console.log("Applying stashed changes to worktree...")
      try {
        execSync("git stash pop", { cwd: worktreePath, stdio: "inherit" })
      } catch {
        console.log("Warning: could not cleanly apply changes. They remain in the stash.")
      }
    } else if (dirty) {
      console.log("Restoring uncommitted changes...")
      try {
        execSync("git stash pop", { stdio: "inherit" })
      } catch {
        console.log("Warning: could not cleanly restore changes. They remain in the stash.")
      }
    }

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
