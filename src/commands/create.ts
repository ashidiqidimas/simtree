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

    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true })
    }

    console.log(`Creating worktree for branch "${branch}"...`)
    const worktreePath = createWorktree(branch)

    console.log("Copying files...")
    copyFiles(repoRoot, worktreePath)

    const simulator = await assignSimulator(worktreePath)

    generateConfig(repoRoot, worktreePath, simulator)

    console.log(`\nWorktree ready: ${worktreePath}`)
    console.log(`Simulator: ${simulator.name} (${simulator.udid})`)
  })
