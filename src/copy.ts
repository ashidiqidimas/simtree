import fs from "node:fs"
import path from "node:path"

interface SimtreeConfig {
  copyFiles: string[]
}

function readSimtreeConfig(repoRoot: string): SimtreeConfig {
  const configPath = path.join(repoRoot, ".simtree")
  if (!fs.existsSync(configPath)) {
    return { copyFiles: [] }
  }
  const raw = fs.readFileSync(configPath, "utf-8")
  return JSON.parse(raw)
}

export function copyFiles(repoRoot: string, worktreePath: string): void {
  const config = readSimtreeConfig(repoRoot)
  if (config.copyFiles.length === 0) return

  for (const file of config.copyFiles) {
    const src = path.join(repoRoot, file)
    const dest = path.join(worktreePath, file)

    if (!fs.existsSync(src)) {
      console.log(`  Skip (not found): ${file}`)
      continue
    }

    const destDir = path.dirname(dest)
    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(src, dest)
    console.log(`  Copied: ${file}`)
  }
}
