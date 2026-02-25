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
simtree sim add <udid>   # name is auto-resolved from Xcode
simtree sim add <udid>
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
simtree sim list           # show pool and lock status
simtree sim add <udid>     # add simulator to pool
simtree sim remove <udid>  # remove from pool
simtree sim prune          # unlock simulators whose worktree no longer exists
```

## How it works

**Simulator pool** is stored globally at `~/.simtree/simulators.json`. You manage it with `simtree sim add/remove`.

**Locks** are tracked in `~/.simtree/locks.json`. When you create a worktree, the first available simulator is locked to it. When all simulators are locked, an interactive prompt lets you force-assign one.

**Stale lock detection**: if a worktree path no longer exists on disk, its lock is automatically pruned.

**Config generation**: reads your repo's `.xcodebuildmcp/config.yaml` as a template, swaps the simulator ID/name and rewrites paths to point into the worktree. Falls back to `~/.simtree/config-template.yaml` if the repo doesn't have one.

**Worktrees** are created under `<repo>/.worktrees/<branch>/`.
