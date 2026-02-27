import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { getSimtreeDir } from "./state.js"

type HookName = "post-create" | "post-close"

export function runHook(
  hookName: HookName,
  env: Record<string, string>,
  cwd: string
): void {
  const hookPath = path.join(getSimtreeDir(), "hooks", `${hookName}.sh`)

  if (!fs.existsSync(hookPath)) return

  console.log(`Running ${hookName} hook...`)

  try {
    execSync(`sh "${hookPath}"`, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["inherit", "inherit", "pipe"],
    })
  } catch (error: unknown) {
    const execError = error as { stderr?: Buffer; status?: number }
    const stderr = execError.stderr?.toString().trim() ?? ""
    const code = execError.status ?? 1
    console.warn(
      `Warning: ${hookName} hook failed (exit code ${code})${stderr ? `:\n${stderr}` : ""}`
    )
  }
}
