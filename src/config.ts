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
  simulatorName?: string
  derivedDataPath?: string
  [key: string]: unknown
}

interface ConfigTemplate {
  path: string
  relativeDir: string
}

interface ConfigTemplates {
  xcodebuildmcp: ConfigTemplate[]
  flowdeck: ConfigTemplate[]
}

function findRepoTemplates(repoRoot: string): ConfigTemplates {
  const templates: ConfigTemplates = { xcodebuildmcp: [], flowdeck: [] }
  const ignoredDirs = new Set([".git", ".worktrees", "node_modules"])

  function visit(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignoredDirs.has(entry.name)) continue

      const entryPath = path.join(dir, entry.name)
      const relativeDir = path.relative(repoRoot, dir)

      if (entry.name === ".xcodebuildmcp") {
        const configPath = path.join(entryPath, "config.yaml")
        if (fs.existsSync(configPath)) {
          templates.xcodebuildmcp.push({ path: configPath, relativeDir })
        }
        continue
      }

      if (entry.name === ".flowdeck") {
        const configPath = path.join(entryPath, "config.json")
        if (fs.existsSync(configPath)) {
          templates.flowdeck.push({ path: configPath, relativeDir })
        }
        continue
      }

      visit(entryPath)
    }
  }

  visit(repoRoot)
  return templates
}

function findTemplates(repoRoot: string): ConfigTemplates {
  const templates = findRepoTemplates(repoRoot)

  if (templates.xcodebuildmcp.length > 0 || templates.flowdeck.length > 0) {
    return templates
  }

  const globalTemplate = getConfigTemplateFile()
  return {
    xcodebuildmcp: fs.existsSync(globalTemplate) ? [{ path: globalTemplate, relativeDir: "" }] : [],
    flowdeck: [],
  }
}

function rebaseProjectPath(
  projectPath: string,
  repoRoot: string,
  worktreePath: string,
  relativeDir: string,
): string {
  if (!path.isAbsolute(projectPath)) {
    return path.join(worktreePath, relativeDir, projectPath)
  }

  const relativePath = path.relative(repoRoot, projectPath)
  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return path.join(worktreePath, relativePath)
  }

  return path.join(worktreePath, relativeDir, path.basename(projectPath))
}

function generateXcodeBuildConfig(
  templatePath: string,
  repoRoot: string,
  worktreePath: string,
  relativeDir: string,
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
    config.sessionDefaults.workspacePath = rebaseProjectPath(
      config.sessionDefaults.workspacePath,
      repoRoot,
      worktreePath,
      relativeDir,
    )
  }

  config.sessionDefaults.derivedDataPath = path.join(
    worktreePath,
    relativeDir,
    ".xcodebuildmcp",
    ".derivedData",
  )

  const outputDir = path.join(worktreePath, relativeDir, ".xcodebuildmcp")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, "config.yaml")
  fs.writeFileSync(outputPath, stringify(config))
  console.log(`Written config: ${outputPath}`)
}

function generateFlowDeckConfig(
  templatePath: string,
  repoRoot: string,
  worktreePath: string,
  relativeDir: string,
  simulator: Simulator,
): void {
  const raw = fs.readFileSync(templatePath, "utf-8")
  const config: FlowDeckConfig = JSON.parse(raw)

  config.simulatorUdid = simulator.udid
  config.simulatorName = simulator.name

  if (config.workspace) {
    config.workspace = rebaseProjectPath(config.workspace, repoRoot, worktreePath, relativeDir)
  }

  config.derivedDataPath = path.join(worktreePath, relativeDir, ".flowdeck", ".derivedData")

  const outputDir = path.join(worktreePath, relativeDir, ".flowdeck")
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
  if (templates.xcodebuildmcp.length === 0 && templates.flowdeck.length === 0) {
    console.error(
      "Error: no config template found.\n" +
        `  Expected under: ${repoRoot}/**/.xcodebuildmcp/config.yaml\n` +
        `  Or under:       ${repoRoot}/**/.flowdeck/config.json\n` +
        `  Or global:      ${getConfigTemplateFile()}`,
    )
    process.exit(1)
  }

  for (const template of templates.xcodebuildmcp) {
    generateXcodeBuildConfig(template.path, repoRoot, worktreePath, template.relativeDir, simulator)
  }

  for (const template of templates.flowdeck) {
    generateFlowDeckConfig(template.path, repoRoot, worktreePath, template.relativeDir, simulator)
  }
}
