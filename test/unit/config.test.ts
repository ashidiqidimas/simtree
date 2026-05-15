import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { generateConfig } from "../../src/config.js"

function makeTempDir(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "simtree-config-test-")))
}

describe("generateConfig", () => {
  it("generates .flowdeck/config.json from a repo template", () => {
    const repoRoot = makeTempDir()
    const worktreePath = makeTempDir()

    try {
      fs.mkdirSync(path.join(repoRoot, ".flowdeck"), { recursive: true })
      fs.writeFileSync(
        path.join(repoRoot, ".flowdeck", "config.json"),
        JSON.stringify(
          {
            workspace: path.join(repoRoot, "App.xcworkspace"),
            scheme: "App",
            configuration: "Debug",
            platform: "iOS",
            simulatorUdid: "OLD-UDID",
            simulatorName: "Old iPhone",
            derivedDataPath: path.join(repoRoot, ".flowdeck", ".derivedData"),
            xcodebuild: { args: ["-quiet"] },
          },
          null,
          2,
        ),
      )

      generateConfig(repoRoot, worktreePath, {
        udid: "NEW-UDID",
        name: "iPhone 17 Pro",
      })

      const output = JSON.parse(
        fs.readFileSync(path.join(worktreePath, ".flowdeck", "config.json"), "utf-8"),
      )
      expect(output).toEqual({
        workspace: path.join(worktreePath, "App.xcworkspace"),
        scheme: "App",
        configuration: "Debug",
        platform: "iOS",
        simulatorUdid: "NEW-UDID",
        simulatorName: "iPhone 17 Pro",
        derivedDataPath: path.join(worktreePath, ".flowdeck", ".derivedData"),
        xcodebuild: { args: ["-quiet"] },
      })
      expect(fs.existsSync(path.join(worktreePath, ".xcodebuildmcp"))).toBe(false)
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
      fs.rmSync(worktreePath, { recursive: true, force: true })
    }
  })

  it("preserves nested workspace paths in .flowdeck/config.json", () => {
    const repoRoot = makeTempDir()
    const worktreePath = makeTempDir()

    try {
      fs.mkdirSync(path.join(repoRoot, ".flowdeck"), { recursive: true })
      fs.writeFileSync(
        path.join(repoRoot, ".flowdeck", "config.json"),
        JSON.stringify({ workspace: path.join(repoRoot, "ios", "App.xcworkspace") }, null, 2),
      )

      generateConfig(repoRoot, worktreePath, {
        udid: "NEW-UDID",
        name: "iPhone 17 Pro",
      })

      const output = JSON.parse(
        fs.readFileSync(path.join(worktreePath, ".flowdeck", "config.json"), "utf-8"),
      )
      expect(output.workspace).toBe(path.join(worktreePath, "ios", "App.xcworkspace"))
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
      fs.rmSync(worktreePath, { recursive: true, force: true })
    }
  })

  it("preserves nested workspace paths in .xcodebuildmcp/config.yaml", () => {
    const repoRoot = makeTempDir()
    const worktreePath = makeTempDir()

    try {
      fs.mkdirSync(path.join(repoRoot, ".xcodebuildmcp"), { recursive: true })
      fs.writeFileSync(
        path.join(repoRoot, ".xcodebuildmcp", "config.yaml"),
        [
          "schemaVersion: 1",
          "enabledWorkflows: []",
          "sessionDefaults:",
          `  workspacePath: ${path.join(repoRoot, "ios", "App.xcworkspace")}`,
        ].join("\n"),
      )

      generateConfig(repoRoot, worktreePath, {
        udid: "NEW-UDID",
        name: "iPhone 17 Pro",
      })

      const output = fs.readFileSync(
        path.join(worktreePath, ".xcodebuildmcp", "config.yaml"),
        "utf-8",
      )
      expect(output).toContain(`workspacePath: ${path.join(worktreePath, "ios", "App.xcworkspace")}`)
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
      fs.rmSync(worktreePath, { recursive: true, force: true })
    }
  })

  it("generates configs found inside nested app folders", () => {
    const repoRoot = makeTempDir()
    const worktreePath = makeTempDir()

    try {
      fs.mkdirSync(path.join(repoRoot, "ios", ".flowdeck"), { recursive: true })
      fs.mkdirSync(path.join(repoRoot, "ios", ".xcodebuildmcp"), { recursive: true })
      fs.writeFileSync(
        path.join(repoRoot, "ios", ".flowdeck", "config.json"),
        JSON.stringify({ workspace: "App.xcworkspace" }, null, 2),
      )
      fs.writeFileSync(
        path.join(repoRoot, "ios", ".xcodebuildmcp", "config.yaml"),
        [
          "schemaVersion: 1",
          "enabledWorkflows: []",
          "sessionDefaults:",
          "  workspacePath: App.xcworkspace",
        ].join("\n"),
      )

      generateConfig(repoRoot, worktreePath, {
        udid: "NEW-UDID",
        name: "iPhone 17 Pro",
      })

      const flowdeckOutput = JSON.parse(
        fs.readFileSync(path.join(worktreePath, "ios", ".flowdeck", "config.json"), "utf-8"),
      )
      const xcodebuildOutput = fs.readFileSync(
        path.join(worktreePath, "ios", ".xcodebuildmcp", "config.yaml"),
        "utf-8",
      )

      expect(flowdeckOutput.workspace).toBe(path.join(worktreePath, "ios", "App.xcworkspace"))
      expect(flowdeckOutput.simulatorName).toBe("iPhone 17 Pro")
      expect(flowdeckOutput.derivedDataPath).toBe(
        path.join(worktreePath, "ios", ".flowdeck", ".derivedData"),
      )
      expect(xcodebuildOutput).toContain(
        `workspacePath: ${path.join(worktreePath, "ios", "App.xcworkspace")}`,
      )
      expect(xcodebuildOutput).toContain(
        `derivedDataPath: ${path.join(worktreePath, "ios", ".xcodebuildmcp", ".derivedData")}`,
      )
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
      fs.rmSync(worktreePath, { recursive: true, force: true })
    }
  })
})
