import { Command } from "commander"
import { getCurrentBranch, getMainRepoRoot, getRepoRoot, isInsideWorktree } from "../git.js"
import { runHook } from "../hooks.js"
import { unlockByWorktree } from "../state.js"

export const deinitCommand = new Command("deinit")
  .description("Unlock the current worktree's simulator without removing the worktree")
  .action(async () => {
    if (!isInsideWorktree()) {
      console.error("Error: deinit must be run inside an existing git worktree.")
      process.exit(1)
    }

    const branch = getCurrentBranch() ?? "(detached)"
    const worktreePath = getRepoRoot()
    const repoRoot = getMainRepoRoot()

    console.log(`Deinitializing worktree "${branch}"...`)

    unlockByWorktree(worktreePath)
    console.log(`Simulator unlocked for: ${worktreePath}`)

    runHook("post-close", {
      SIMTREE_BRANCH: branch,
      SIMTREE_WORKTREE_PATH: worktreePath,
      SIMTREE_REPO_ROOT: repoRoot,
    }, repoRoot)
  })
