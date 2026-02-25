import { Command } from "commander"
import { getWorktreesDir, listWorktrees } from "../git.js"
import { readLocks, readSimulators } from "../state.js"

export const listCommand = new Command("list")
  .description("List active worktrees with their assigned simulators")
  .action(() => {
    const worktreesDir = getWorktreesDir()
    const worktrees = listWorktrees().filter((wt) =>
      wt.path.startsWith(worktreesDir)
    )

    if (worktrees.length === 0) {
      console.log("No active worktrees.")
      return
    }

    const locks = readLocks()
    const simulators = readSimulators()

    for (const wt of worktrees) {
      const lock = locks.find((l) => l.worktreePath === wt.path)
      let simInfo = "no simulator"
      if (lock) {
        const sim = simulators.find((s) => s.udid === lock.udid)
        simInfo = sim ? `${sim.name} (${sim.udid})` : lock.udid
      }
      console.log(`  ${wt.branch} — ${simInfo}`)
      console.log(`    ${wt.path}`)
    }
  })
