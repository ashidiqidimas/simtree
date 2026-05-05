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
        derivedDataPath: path.join(worktreePath, ".flowdeck", ".derivedData"),
        xcodebuild: { args: ["-quiet"] },
      })
      expect(fs.existsSync(path.join(worktreePath, ".xcodebuildmcp"))).toBe(false)
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
      fs.rmSync(worktreePath, { recursive: true, force: true })
    }
  })
})
