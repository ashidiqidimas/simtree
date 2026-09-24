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

interface MobileBuildConfig {
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

interface MobileBuildConfigTemplate extends ConfigTemplate {
  configDirName: string
}

interface ConfigTemplates {
  mobilebuildmcp: MobileBuildConfigTemplate[]
  flowdeck: ConfigTemplate[]
}

// XcodeBuildMCP was renamed to MobileBuildMCP, which only reads `.mobilebuildmcp`.
// The legacy directory stays supported for repos still pinned to XcodeBuildMCP.
const MOBILEBUILDMCP_CONFIG_DIR = ".mobilebuildmcp"
const MOBILEBUILDMCP_CONFIG_DIRS = new Set([MOBILEBUILDMCP_CONFIG_DIR, ".xcodebuildmcp"])

function findRepoTemplates(repoRoot: string): ConfigTemplates {
  const templates: ConfigTemplates = { mobilebuildmcp: [], flowdeck: [] }
  const ignoredDirs = new Set([".git", ".worktrees", "node_modules"])

  function visit(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignoredDirs.has(entry.name)) continue

      const entryPath = path.join(dir, entry.name)
      const relativeDir = path.relative(repoRoot, dir)

      if (MOBILEBUILDMCP_CONFIG_DIRS.has(entry.name)) {
        const configPath = path.join(entryPath, "config.yaml")
        if (fs.existsSync(configPath)) {
          templates.mobilebuildmcp.push({ path: configPath, relativeDir, configDirName: entry.name })
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

  if (templates.mobilebuildmcp.length > 0 || templates.flowdeck.length > 0) {
    return templates
  }

  const globalTemplate = getConfigTemplateFile()
  return {
    mobilebuildmcp: fs.existsSync(globalTemplate)
      ? [{ path: globalTemplate, relativeDir: "", configDirName: MOBILEBUILDMCP_CONFIG_DIR }]
      : [],
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

function generateMobileBuildConfig(
  template: MobileBuildConfigTemplate,
  repoRoot: string,
  worktreePath: string,
  simulator: Simulator,
): void {
  const { path: templatePath, relativeDir, configDirName } = template
  const raw = fs.readFileSync(templatePath, "utf-8")
  const config: MobileBuildConfig = parse(raw)

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

  if (config.sessionDefaults.derivedDataPath) {
    config.sessionDefaults.derivedDataPath = rebaseProjectPath(
      config.sessionDefaults.derivedDataPath,
      repoRoot,
      worktreePath,
      relativeDir,
    )
  }

  const outputDir = path.join(worktreePath, relativeDir, configDirName)
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

  if (config.derivedDataPath) {
    config.derivedDataPath = rebaseProjectPath(
      config.derivedDataPath,
      repoRoot,
      worktreePath,
      relativeDir,
    )
  }

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
  if (templates.mobilebuildmcp.length === 0 && templates.flowdeck.length === 0) {
    console.error(
      "Error: no config template found.\n" +
        `  Expected under: ${repoRoot}/**/.mobilebuildmcp/config.yaml\n` +
        `  Or under:       ${repoRoot}/**/.xcodebuildmcp/config.yaml\n` +
        `  Or under:       ${repoRoot}/**/.flowdeck/config.json\n` +
        `  Or global:      ${getConfigTemplateFile()}`,
    )
    process.exit(1)
  }

  for (const template of templates.mobilebuildmcp) {
    generateMobileBuildConfig(template, repoRoot, worktreePath, simulator)
  }

  for (const template of templates.flowdeck) {
    generateFlowDeckConfig(template.path, repoRoot, worktreePath, template.relativeDir, simulator)
  }
}
