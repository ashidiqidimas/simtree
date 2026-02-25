import fs from "node:fs"
import path from "node:path"
import { parse, stringify } from "yaml"
import { CONFIG_TEMPLATE_FILE } from "./state.js"
import type { Simulator } from "./state.js"

interface XcodeBuildConfig {
  schemaVersion: number
  enabledWorkflows: string[]
  sessionDefaults: {
    workspacePath: string
    scheme: string
    configuration: string
    simulatorName: string
    simulatorId: string
    simulatorPlatform: string
    derivedDataPath: string
    platform: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function findTemplate(repoRoot: string): string | null {
  const repoConfig = path.join(repoRoot, ".xcodebuildmcp", "config.yaml")
  if (fs.existsSync(repoConfig)) return repoConfig

  if (fs.existsSync(CONFIG_TEMPLATE_FILE)) return CONFIG_TEMPLATE_FILE

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
        `  Or global:   ${CONFIG_TEMPLATE_FILE}`,
    )
    process.exit(1)
  }

  const raw = fs.readFileSync(templatePath, "utf-8")
  const config: XcodeBuildConfig = parse(raw)

  // Rewrite simulator fields
  config.sessionDefaults.simulatorId = simulator.udid
  config.sessionDefaults.simulatorName = simulator.name

  // Rewrite workspace path: replace repo root with worktree path
  const oldWorkspace = config.sessionDefaults.workspacePath
  if (oldWorkspace) {
    const workspaceRelative = path.basename(oldWorkspace)
    config.sessionDefaults.workspacePath = path.join(worktreePath, workspaceRelative)
  }

  // Rewrite derived data path
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
