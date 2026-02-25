# simtree Design

A TypeScript CLI tool for managing git worktrees with automatic iOS simulator assignment.

## Commands

| Command | Description |
|---|---|
| `simtree create <branch>` | Create worktree, auto-assign simulator, copy files, write config |
| `simtree close [branch]` | Remove worktree + unlock simulator (interactive if no branch given) |
| `simtree list` | List active worktrees with assigned simulators |
| `simtree sim list` | Show simulator pool and lock status |
| `simtree sim add <udid>` | Add simulator to pool (name auto-resolved via `xcrun simctl`) |
| `simtree sim remove <udid>` | Remove simulator from pool |
| `simtree sim prune` | Unlock simulators whose worktree path no longer exists |

## Storage

### Global (`~/.simtree/`)

- `simulators.json` — simulator pool: `[{ udid, name }]`
- `locks.json` — lock state: `[{ udid, worktreePath, lockedAt }]`
- `config-template.yaml` — fallback xcodebuildmcp config template

### Per-repo

- `<repo>/.simtree` — JSON config, initially `{ "copyFiles": ["CLAUDE.local.md"] }`
- `<repo>/.worktrees/<branch>/` — worktree location

## Flows

### `simtree create <branch>`

1. Verify we're in a git repo root
2. Create `.worktrees/` dir if it doesn't exist
3. Run `git worktree add .worktrees/<branch> -b <branch>` (or checkout existing branch)
4. Read `.simtree` config, copy listed files from main repo into the worktree
5. Find an unlocked simulator:
   - Prune locks where worktree path no longer exists
   - Pick first unlocked simulator
   - If all locked: launch interactive prompt to pick one (force-assign)
6. Lock the chosen simulator in `~/.simtree/locks.json`
7. Generate `.xcodebuildmcp/config.yaml` in the worktree:
   - Template: main repo's `.xcodebuildmcp/config.yaml` if exists, else `~/.simtree/config-template.yaml`
   - Replace: `simulatorId`, `simulatorName`, `workspacePath`, `derivedDataPath`
   - Preserve all other fields

### `simtree close [branch]`

1. If branch provided, target `.worktrees/<branch>`
2. If no branch, list active worktrees interactively and let user pick
3. Run `git worktree remove .worktrees/<branch>`
4. Unlock the simulator assigned to that worktree path

### Stale Lock Detection

A lock is stale if its `worktreePath` no longer exists on disk. Stale locks are pruned:
- Automatically before assigning a simulator in `create`
- Manually via `simtree sim prune`

No time-based timeout.

## Config Template Resolution

When generating `.xcodebuildmcp/config.yaml` for a worktree:

1. Try `<repo-root>/.xcodebuildmcp/config.yaml` first
2. Fall back to `~/.simtree/config-template.yaml`
3. Fail with helpful error if neither exists

Fields rewritten:
- `simulatorId` → assigned simulator UDID
- `simulatorName` → assigned simulator name
- `workspacePath` → rewritten to worktree path
- `derivedDataPath` → `.xcodebuildmcp/.derivedData` inside worktree

All other fields preserved as-is.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **CLI framework:** commander
- **Interactive prompts:** @inquirer/prompts
- **Bundler:** tsup
- **Package manager:** pnpm
- **Lock management:** flat JSON files (no database, no daemon)

## Decisions

- Simulator pool is manually managed via `simtree sim add/remove` (no auto-discovery)
- Simulator name is auto-resolved from UDID via `xcrun simctl list`
- Worktrees are created inside `<repo>/.worktrees/`
- Per-repo config (`.simtree`) is JSON and extensible for future settings
- All simulators locked → interactive picker to force-assign
- `close` automatically unlocks the assigned simulator
