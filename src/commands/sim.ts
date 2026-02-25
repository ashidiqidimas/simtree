import { Command } from "commander"
import { readSimulators, writeSimulators, readLocks, pruneStaleLocks } from "../state.js"
import { resolveSimulatorName } from "../simulator.js"

export const simCommand = new Command("sim")
  .description("Manage simulator pool")

simCommand
  .command("add <udid>")
  .description("Add a simulator to the pool")
  .action((udid: string) => {
    const simulators = readSimulators()
    if (simulators.some((s) => s.udid === udid)) {
      console.error(`Simulator ${udid} is already in the pool.`)
      process.exit(1)
    }
    const name = resolveSimulatorName(udid)
    simulators.push({ udid, name })
    writeSimulators(simulators)
    console.log(`Added: ${name} (${udid})`)
  })

simCommand
  .command("remove <udid>")
  .description("Remove a simulator from the pool")
  .action((udid: string) => {
    const simulators = readSimulators()
    const filtered = simulators.filter((s) => s.udid !== udid)
    if (filtered.length === simulators.length) {
      console.error(`Simulator ${udid} is not in the pool.`)
      process.exit(1)
    }
    writeSimulators(filtered)
    console.log(`Removed: ${udid}`)
  })

simCommand
  .command("list")
  .description("Show all simulators and their lock status")
  .action(() => {
    const simulators = readSimulators()
    const locks = readLocks()

    if (simulators.length === 0) {
      console.log("No simulators in pool. Run `simtree sim add <udid>` to add one.")
      return
    }

    for (const sim of simulators) {
      const lock = locks.find((l) => l.udid === sim.udid)
      const status = lock ? `LOCKED (${lock.worktreePath})` : "available"
      console.log(`  ${sim.name} (${sim.udid}) — ${status}`)
    }
  })

simCommand
  .command("prune")
  .description("Unlock simulators whose worktree no longer exists")
  .action(() => {
    const before = readLocks().length
    const after = pruneStaleLocks().length
    const pruned = before - after
    if (pruned > 0) {
      console.log(`Pruned ${pruned} stale lock(s).`)
    } else {
      console.log("No stale locks found.")
    }
  })
