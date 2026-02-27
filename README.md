# simtree

CLI tool for managing git worktrees with automatic iOS simulator assignment. Built for multi-agent iOS development workflows where each agent needs its own worktree and simulator.

## What it does

- Creates git worktrees with a single command
- Automatically assigns an available iOS simulator from a pool
- Generates `.xcodebuildmcp/config.yaml` in each worktree with the correct simulator
- Copies gitignored files (like `CLAUDE.local.md`) into new worktrees
- Locks simulators so multiple agents don't fight over the same one
- Cleans up everything when you close a worktree

## Install

```bash
pnpm add -g @ashidiqidimas/simtree
simtree completions  # install zsh completions
```

## Setup

Add simulators to the pool:

```bash
simtree simulator add <udid>   # name is auto-resolved from Xcode
simtree simulator add <udid>
```

Create a `.simtree` file in your repo root to list gitignored files that should be copied to worktrees:

```json
{
  "copyFiles": ["CLAUDE.local.md"]
}
```

## Usage

```bash
# Create a worktree — assigns a simulator, copies files, writes config
simtree create feature-branch

# List active worktrees and their simulators
simtree list

# Close a worktree — removes it and unlocks the simulator
simtree close feature-branch
simtree close              # interactive picker
```

### Simulator management

```bash
simtree simulator list           # show pool and lock status
simtree simulator add <udid>     # add simulator to pool
simtree simulator remove <udid>  # remove from pool
simtree simulator prune          # unlock simulators whose worktree no longer exists
```

## Hooks

simtree supports lifecycle hooks that run shell scripts after worktree creation and removal. Place scripts in `~/.simtree/hooks/`:

| Hook | When it runs | Working directory |
|------|-------------|-------------------|
| `post-create.sh` | After worktree is fully set up | The new worktree |
| `post-close.sh` | After worktree is removed | The main repo root |

Scripts are executed via `sh`, so no `chmod +x` is needed — just create the file.

**Environment variables** available in hooks:

| Variable | post-create | post-close |
|----------|:-----------:|:----------:|
| `SIMTREE_BRANCH` | yes | yes |
| `SIMTREE_WORKTREE_PATH` | yes | yes |
| `SIMTREE_REPO_ROOT` | yes | yes |
| `SIMTREE_SIMULATOR_UDID` | yes | — |
| `SIMTREE_SIMULATOR_NAME` | yes | — |

**Example** — run tuist setup after creating a worktree:

```bash
mkdir -p ~/.simtree/hooks
cat > ~/.simtree/hooks/post-create.sh << 'EOF'
tuist install && tuist cache && tuist generate --no-open
EOF
```

If a hook fails, simtree prints a warning and continues — hooks never abort the parent command.

## Configuration

### Global (`~/.simtree/`)

All global state lives in `~/.simtree/` (override with `SIMTREE_HOME` env var):

| File | Purpose |
|------|---------|
| `config.json` | Global settings (e.g., `defaultBranch`) |
| `simulators.json` | Simulator pool managed by `simtree simulator add/remove` |
| `locks.json` | Tracks which simulator is assigned to which worktree |
| `config-template.yaml` | Fallback xcodebuildmcp config template |
| `hooks/post-create.sh` | Hook script run after worktree creation |
| `hooks/post-close.sh` | Hook script run after worktree removal |

```json
// config.json
{
  "defaultBranch": "main"
}
```

### Per-repo (`.simtree`)

Create a `.simtree` JSON file in your repo root:

```json
{
  "copyFiles": ["CLAUDE.local.md"]
}
```

| Field | Description |
|-------|-------------|
| `copyFiles` | List of gitignored files to copy from the main repo into new worktrees |

### Per-repo xcodebuildmcp template (`.xcodebuildmcp/config.yaml`)

If your repo has `.xcodebuildmcp/config.yaml`, simtree uses it as a template when generating worktree configs. It rewrites the simulator ID/name and paths to point into the worktree. If the repo doesn't have one, it falls back to `~/.simtree/config-template.yaml`.

## How it works

**Simulator pool**: managed via `simtree simulator add/remove`. When you create a worktree, the first available simulator is locked to it. When all are locked, an interactive prompt lets you force-assign one.

**Stale lock detection**: if a worktree path no longer exists on disk, its lock is automatically pruned.

**Worktrees** are created under `~/.simtree/worktrees/<repoName>-<hash>/<branch>/`.
