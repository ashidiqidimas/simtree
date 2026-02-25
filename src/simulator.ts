import { execSync } from "node:child_process"
import { select } from "@inquirer/prompts"
import { readSimulators, readLocks, pruneStaleLocks, lockSimulator } from "./state.js"
import type { Simulator } from "./state.js"

interface SimctlDevice {
  udid: string
  name: string
}

function listAvailableDevices(): Array<SimctlDevice> {
  const output = execSync("xcrun simctl list devices available --json", {
    encoding: "utf-8",
  })
  const data = JSON.parse(output)
  const devices: Array<SimctlDevice> = []
  for (const runtime of Object.values(data.devices) as Array<Array<SimctlDevice>>) {
    for (const device of runtime) {
      devices.push({ udid: device.udid, name: device.name })
    }
  }
  return devices
}

export function resolveSimulatorName(udid: string): string {
  try {
    const device = listAvailableDevices().find((d) => d.udid === udid)
    if (device) {
      return device.name
    }
  } catch {
    // Fall through
  }
  console.error(`Error: could not resolve simulator name for UDID "${udid}".`)
  process.exit(1)
}

export function getAvailableSimulators(): Array<SimctlDevice> {
  try {
    return listAvailableDevices()
  } catch {
    console.error("Error: failed to list available simulators.")
    process.exit(1)
  }
}

export async function assignSimulator(worktreePath: string): Promise<Simulator> {
  const simulators = readSimulators()
  if (simulators.length === 0) {
    console.error("Error: no simulators in pool. Run `simtree simulator add` first.")
    process.exit(1)
  }

  const locks = pruneStaleLocks()
  const lockedUdids = new Set(locks.map((l) => l.udid))
  const unlocked = simulators.filter((s) => !lockedUdids.has(s.udid))

  let chosen: Simulator

  if (unlocked.length > 0) {
    chosen = unlocked[0]
    console.log(`Assigned simulator: ${chosen.name} (${chosen.udid})`)
  } else {
    console.log("All simulators are locked. Choose one to force-assign:")
    const answer = await select({
      message: "Select a simulator:",
      choices: simulators.map((s) => {
        const lock = locks.find((l) => l.udid === s.udid)
        const lockInfo = lock ? ` [locked by ${lock.worktreePath}]` : ""
        return {
          name: `${s.name} (${s.udid})${lockInfo}`,
          value: s.udid,
        }
      }),
    })
    chosen = simulators.find((s) => s.udid === answer)!
    console.log(`Force-assigned simulator: ${chosen.name} (${chosen.udid})`)
  }

  lockSimulator(chosen.udid, worktreePath)
  return chosen
}
