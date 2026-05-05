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

interface FlowDeckConfig {
  workspace?: string
  scheme?: string
  configuration?: string
  platform?: string
  simulatorUdid?: string
  derivedDataPath?: string
  [key: string]: unknown
}

interface ConfigTemplates {
  xcodebuildmcp: string | null
  flowdeck: string | null
}

function findTemplates(repoRoot: string): ConfigTemplates {
  const repoXcodeBuildConfig = path.join(repoRoot, ".xcodebuildmcp", "config.yaml")
  const repoFlowDeckConfig = path.join(repoRoot, ".flowdeck", "config.json")

  const xcodebuildmcp = fs.existsSync(repoXcodeBuildConfig) ? repoXcodeBuildConfig : null
  const flowdeck = fs.existsSync(repoFlowDeckConfig) ? repoFlowDeckConfig : null

  if (xcodebuildmcp || flowdeck) {
    return { xcodebuildmcp, flowdeck }
  }

  const globalTemplate = getConfigTemplateFile()
  return {
    xcodebuildmcp: fs.existsSync(globalTemplate) ? globalTemplate : null,
    flowdeck: null,
  }
}

function generateXcodeBuildConfig(
  templatePath: string,
  worktreePath: string,
  simulator: Simulator,
): void {
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

  const outputDir = path.join(worktreePath, ".xcodebuildmcp")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, "config.yaml")
  fs.writeFileSync(outputPath, stringify(config))
  console.log(`Written config: ${outputPath}`)
}

function generateFlowDeckConfig(
  templatePath: string,
  worktreePath: string,
  simulator: Simulator,
): void {
  const raw = fs.readFileSync(templatePath, "utf-8")
  const config: FlowDeckConfig = JSON.parse(raw)

  config.simulatorUdid = simulator.udid

  if (config.workspace) {
    const workspaceRelative = path.basename(config.workspace)
    config.workspace = path.join(worktreePath, workspaceRelative)
  }

  config.derivedDataPath = path.join(worktreePath, ".flowdeck", ".derivedData")

  const outputDir = path.join(worktreePath, ".flowdeck")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, "config.json")
  fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`)
  console.log(`Written config: ${outputPath}`)
}

export function generateConfig(
  repoRoot: string,
  worktreePath: string,
  simulator: Simulator,
): void {
  const templates = findTemplates(repoRoot)
  if (!templates.xcodebuildmcp && !templates.flowdeck) {
    console.error(
      "Error: no config template found.\n" +
        `  Expected at: ${repoRoot}/.xcodebuildmcp/config.yaml\n` +
        `  Or:          ${repoRoot}/.flowdeck/config.json\n` +
        `  Or global:   ${getConfigTemplateFile()}`,
    )
    process.exit(1)
  }

  if (templates.xcodebuildmcp) {
    generateXcodeBuildConfig(templates.xcodebuildmcp, worktreePath, simulator)
  }

  if (templates.flowdeck) {
    generateFlowDeckConfig(templates.flowdeck, worktreePath, simulator)
  }
}
