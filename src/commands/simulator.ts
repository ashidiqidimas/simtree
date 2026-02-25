import { Command } from "commander"
import { select } from "@inquirer/prompts"
import { readSimulators, writeSimulators, readLocks, pruneStaleLocks } from "../state.js"
import { resolveSimulatorName, getAvailableSimulators } from "../simulator.js"

export const simulatorCommand = new Command("simulator")
  .description("Manage simulator pool")

simulatorCommand
  .command("add")
  .description("Add a simulator to the pool")
  .option("--udid <udid>", "Add a simulator directly by UDID")
  .action(async (opts: { udid?: string }) => {
    const simulators = readSimulators()
    let udid: string

    if (opts.udid) {
      udid = opts.udid
    } else {
      const available = getAvailableSimulators()
      const poolUdids = new Set(simulators.map((s) => s.udid))
      const notInPool = available.filter((d) => !poolUdids.has(d.udid))

      if (notInPool.length === 0) {
        console.log("All available simulators are already in the pool.")
        return
      }

      udid = await select({
        message: "Select a simulator to add:",
        choices: notInPool.map((d) => ({
          name: `${d.name} (${d.udid})`,
          value: d.udid,
        })),
      })
    }

    if (simulators.some((s) => s.udid === udid)) {
      console.error(`Simulator ${udid} is already in the pool.`)
      process.exit(1)
    }
    const name = resolveSimulatorName(udid)
    simulators.push({ udid, name })
    writeSimulators(simulators)
    console.log(`Added: ${name} (${udid})`)
  })

simulatorCommand
  .command("remove")
  .description("Remove a simulator from the pool")
  .option("--udid <udid>", "Remove a simulator directly by UDID")
  .action(async (opts: { udid?: string }) => {
    const simulators = readSimulators()

    if (simulators.length === 0) {
      console.log("No simulators in pool.")
      return
    }

    let udid: string

    if (opts.udid) {
      udid = opts.udid
    } else {
      const locks = readLocks()
      udid = await select({
        message: "Select a simulator to remove:",
        choices: simulators.map((s) => {
          const lock = locks.find((l) => l.udid === s.udid)
          const lockInfo = lock ? ` [locked by ${lock.worktreePath}]` : ""
          return {
            name: `${s.name} (${s.udid})${lockInfo}`,
            value: s.udid,
          }
        }),
      })
    }

    const filtered = simulators.filter((s) => s.udid !== udid)
    if (filtered.length === simulators.length) {
      console.error(`Simulator ${udid} is not in the pool.`)
      process.exit(1)
    }
    writeSimulators(filtered)
    const removed = simulators.find((s) => s.udid === udid)!
    console.log(`Removed: ${removed.name} (${udid})`)
  })

simulatorCommand
  .command("list")
  .description("Show all simulators and their lock status")
  .action(() => {
    const simulators = readSimulators()
    const locks = readLocks()

    if (simulators.length === 0) {
      console.log("No simulators in pool. Run `simtree simulator add` to add one.")
      return
    }

    for (const sim of simulators) {
      const lock = locks.find((l) => l.udid === sim.udid)
      const status = lock ? `LOCKED (${lock.worktreePath})` : "available"
      console.log(`  ${sim.name} (${sim.udid}) — ${status}`)
    }
  })

simulatorCommand
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
