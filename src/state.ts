import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const SIMTREE_DIR = path.join(os.homedir(), ".simtree")
const SIMULATORS_FILE = path.join(SIMTREE_DIR, "simulators.json")
const LOCKS_FILE = path.join(SIMTREE_DIR, "locks.json")

export const CONFIG_TEMPLATE_FILE = path.join(SIMTREE_DIR, "config-template.yaml")

export interface Simulator {
  udid: string
  name: string
}

export interface Lock {
  udid: string
  worktreePath: string
  lockedAt: string
}

function ensureDir(): void {
  if (!fs.existsSync(SIMTREE_DIR)) {
    fs.mkdirSync(SIMTREE_DIR, { recursive: true })
  }
}

export function readSimulators(): Simulator[] {
  if (!fs.existsSync(SIMULATORS_FILE)) return []
  const raw = fs.readFileSync(SIMULATORS_FILE, "utf-8")
  return JSON.parse(raw)
}

export function writeSimulators(simulators: Simulator[]): void {
  ensureDir()
  fs.writeFileSync(SIMULATORS_FILE, JSON.stringify(simulators, null, 2) + "\n")
}

export function readLocks(): Lock[] {
  if (!fs.existsSync(LOCKS_FILE)) return []
  const raw = fs.readFileSync(LOCKS_FILE, "utf-8")
  return JSON.parse(raw)
}

export function writeLocks(locks: Lock[]): void {
  ensureDir()
  fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 2) + "\n")
}

export function pruneStaleLocks(): Lock[] {
  const locks = readLocks()
  const valid = locks.filter((lock) => fs.existsSync(lock.worktreePath))
  if (valid.length !== locks.length) {
    writeLocks(valid)
  }
  return valid
}

export function lockSimulator(udid: string, worktreePath: string): void {
  const locks = pruneStaleLocks()
  const existing = locks.find((l) => l.udid === udid)
  if (existing) {
    existing.worktreePath = worktreePath
    existing.lockedAt = new Date().toISOString()
  } else {
    locks.push({ udid, worktreePath, lockedAt: new Date().toISOString() })
  }
  writeLocks(locks)
}

export function unlockByWorktree(worktreePath: string): void {
  const locks = readLocks()
  const filtered = locks.filter((l) => l.worktreePath !== worktreePath)
  writeLocks(filtered)
}
