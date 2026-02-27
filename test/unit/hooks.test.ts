import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runHook } from "../../src/hooks.js"

describe("runHook", () => {
  let tempDir: string
  let originalHome: string | undefined

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "simtree-hooks-test-"))
    )
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

  it("silently skips when hook file does not exist", () => {
    expect(() => {
      runHook("post-create", {}, tempDir)
    }).not.toThrow()
  })

  it("runs the hook script and passes environment variables", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })

    const markerFile = path.join(tempDir, "hook-ran.txt")
    fs.writeFileSync(
      path.join(hooksDir, "post-create.sh"),
      `echo "$SIMTREE_BRANCH" > "${markerFile}"`
    )

    runHook("post-create", { SIMTREE_BRANCH: "feat/test" }, tempDir)

    expect(fs.existsSync(markerFile)).toBe(true)
    expect(fs.readFileSync(markerFile, "utf-8").trim()).toBe("feat/test")
  })

  it("runs the hook with the specified working directory", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })

    const markerFile = path.join(tempDir, "cwd.txt")
    fs.writeFileSync(
      path.join(hooksDir, "post-create.sh"),
      `pwd > "${markerFile}"`
    )

    runHook("post-create", {}, tempDir)

    expect(fs.readFileSync(markerFile, "utf-8").trim()).toBe(tempDir)
  })

  it("does not throw when hook script fails", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })
    fs.writeFileSync(path.join(hooksDir, "post-create.sh"), "exit 1")

    expect(() => {
      runHook("post-create", {}, tempDir)
    }).not.toThrow()
  })

  it("prints a warning when hook script fails", () => {
    const hooksDir = path.join(tempDir, "hooks")
    fs.mkdirSync(hooksDir, { recursive: true })
    fs.writeFileSync(
      path.join(hooksDir, "post-create.sh"),
      'echo "something broke" >&2\nexit 1'
    )

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(" "))
    }

    runHook("post-create", {}, tempDir)

    console.warn = originalWarn
    expect(warnings.some((w) => w.includes("post-create"))).toBe(true)
  })
})
