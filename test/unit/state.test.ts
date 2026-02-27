import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getDefaultBranch,
  readGlobalConfig,
  writeGlobalConfig,
} from "../../src/state.js"

describe("global config", () => {
  let tempDir: string
  let originalHome: string | undefined

  beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "simtree-state-test-")))
    originalHome = process.env.SIMTREE_HOME
    process.env.SIMTREE_HOME = tempDir
  })

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.SIMTREE_HOME
    } else {
      process.env.SIMTREE_HOME = originalHome
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it("getDefaultBranch returns 'main' when no config exists", () => {
    expect(getDefaultBranch()).toBe("main")
  })

  it("getDefaultBranch returns configured value when config exists", () => {
    writeGlobalConfig({ defaultBranch: "develop" })
    expect(getDefaultBranch()).toBe("develop")
  })

  it("readGlobalConfig returns empty object when no config exists", () => {
    expect(readGlobalConfig()).toEqual({})
  })

  it("writeGlobalConfig persists to disk", () => {
    writeGlobalConfig({ defaultBranch: "release" })

    const configPath = path.join(tempDir, "config.json")
    expect(fs.existsSync(configPath)).toBe(true)

    const raw = fs.readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(raw)
    expect(parsed).toEqual({ defaultBranch: "release" })
  })

  it("writeGlobalConfig creates the directory if it does not exist", () => {
    const nested = path.join(tempDir, "nested", "dir")
    process.env.SIMTREE_HOME = nested

    writeGlobalConfig({ defaultBranch: "main" })

    const configPath = path.join(nested, "config.json")
    expect(fs.existsSync(configPath)).toBe(true)
  })
})
