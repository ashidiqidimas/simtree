import fs from "node:fs"
import path from "node:path"
import os from "node:os"

function getSimtreeDir(): string {
  return process.env.SIMTREE_HOME ?? path.join(os.homedir(), ".simtree")
}

function getSimulatorsFile(): string {
  return path.join(getSimtreeDir(), "simulators.json")
}

function getLocksFile(): string {
  return path.join(getSimtreeDir(), "locks.json")
}

export function getConfigTemplateFile(): string {
  return path.join(getSimtreeDir(), "config-template.yaml")
}

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
  const dir = getSimtreeDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function readSimulators(): Simulator[] {
  if (!fs.existsSync(getSimulatorsFile())) return []
  const raw = fs.readFileSync(getSimulatorsFile(), "utf-8")
  return JSON.parse(raw)
}

export function writeSimulators(simulators: Simulator[]): void {
  ensureDir()
  fs.writeFileSync(getSimulatorsFile(), JSON.stringify(simulators, null, 2) + "\n")
}

export function readLocks(): Lock[] {
  if (!fs.existsSync(getLocksFile())) return []
  const raw = fs.readFileSync(getLocksFile(), "utf-8")
  return JSON.parse(raw)
}

export function writeLocks(locks: Lock[]): void {
  ensureDir()
  fs.writeFileSync(getLocksFile(), JSON.stringify(locks, null, 2) + "\n")
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

export interface GlobalConfig {
  defaultBranch?: string
}

export function readGlobalConfig(): GlobalConfig {
  const configFile = path.join(getSimtreeDir(), "config.json")
  if (!fs.existsSync(configFile)) return {}
  const raw = fs.readFileSync(configFile, "utf-8")
  return JSON.parse(raw)
}

export function writeGlobalConfig(config: GlobalConfig): void {
  ensureDir()
  const configFile = path.join(getSimtreeDir(), "config.json")
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n")
}

export function getDefaultBranch(): string {
  const config = readGlobalConfig()
  return config.defaultBranch ?? "main"
}
