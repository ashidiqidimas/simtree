import fs from "node:fs"
import path from "node:path"
import { parse, stringify } from "yaml"
import { getConfigTemplateFile } from "./state.js"
import type { Simulator } from "./state.js"

interface SessionDefaults {
  workspacePath?: string
  scheme?: string
  configuration?: string
  simulatorName?: string
  simulatorId?: string
  simulatorPlatform?: string
  derivedDataPath?: string
  platform?: string
  [key: string]: unknown
}

interface XcodeBuildConfig {
  schemaVersion: number
  enabledWorkflows: string[]
  sessionDefaults?: SessionDefaults
  [key: string]: unknown
}

function findTemplate(repoRoot: string): string | null {
  const repoConfig = path.join(repoRoot, ".xcodebuildmcp", "config.yaml")
  if (fs.existsSync(repoConfig)) return repoConfig

  const globalTemplate = getConfigTemplateFile()
  if (fs.existsSync(globalTemplate)) return globalTemplate

  return null
}

export function generateConfig(
  repoRoot: string,
  worktreePath: string,
  simulator: Simulator,
): void {
  const templatePath = findTemplate(repoRoot)
  if (!templatePath) {
    console.error(
      "Error: no xcodebuildmcp config template found.\n" +
        `  Expected at: ${repoRoot}/.xcodebuildmcp/config.yaml\n` +
        `  Or global:   ${getConfigTemplateFile()}`,
    )
    process.exit(1)
  }

  const raw = fs.readFileSync(templatePath, "utf-8")
  const config: XcodeBuildConfig = parse(raw)

  if (!config.sessionDefaults) {
    config.sessionDefaults = {}
  }

  config.sessionDefaults.simulatorId = simulator.udid
  config.sessionDefaults.simulatorName = simulator.name

  if (config.sessionDefaults.workspacePath) {
    const workspaceRelative = path.basename(config.sessionDefaults.workspacePath)
    config.sessionDefaults.workspacePath = path.join(worktreePath, workspaceRelative)
  }

  config.sessionDefaults.derivedDataPath = path.join(
    worktreePath,
    ".xcodebuildmcp",
    ".derivedData",
  )

  // Write config
  const outputDir = path.join(worktreePath, ".xcodebuildmcp")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, "config.yaml")
  fs.writeFileSync(outputPath, stringify(config))
  console.log(`Written config: ${outputPath}`)
}
