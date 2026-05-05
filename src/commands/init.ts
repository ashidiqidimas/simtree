import { Command } from "commander"
import { getCurrentBranch, getMainRepoRoot, getRepoRoot, isInsideWorktree } from "../git.js"
import { assignSimulator } from "../simulator.js"
import { generateConfig } from "../config.js"
import { copyFiles } from "../copy.js"
import { runHook } from "../hooks.js"

export const initCommand = new Command("init")
  .description("Initialize the current worktree with a simulator and config")
  .action(async () => {
    const worktreePath = getRepoRoot()

    if (!isInsideWorktree()) {
      console.error("Error: init must be run inside an existing git worktree.")
      process.exit(1)
    }

    const repoRoot = getMainRepoRoot()
    const branch = getCurrentBranch() ?? "(detached)"

    console.log(`Initializing worktree: ${worktreePath}`)

    console.log("Copying files...")
    copyFiles(repoRoot, worktreePath)

    const simulator = await assignSimulator(worktreePath)

    generateConfig(repoRoot, worktreePath, simulator)

    runHook("post-create", {
      SIMTREE_BRANCH: branch,
      SIMTREE_WORKTREE_PATH: worktreePath,
      SIMTREE_REPO_ROOT: repoRoot,
      SIMTREE_SIMULATOR_UDID: simulator.udid,
      SIMTREE_SIMULATOR_NAME: simulator.name,
    }, worktreePath)

    console.log(`\nWorktree ready: ${worktreePath}`)
    console.log(`Simulator: ${simulator.name} (${simulator.udid})`)
  })
