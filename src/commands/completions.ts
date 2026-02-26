import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { Command } from "commander"

const ZSH_COMPLETION = `#compdef simtree

_simtree_branches() {
  local -a branches
  branches=(\${(f)"$(git branch --format='%(refname:short)' 2>/dev/null)"})
  _describe 'branch' branches
}

_simtree_worktree_branches() {
  local repo_root repo_name short_hash worktrees_dir
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  repo_name="\${repo_root:t}"
  short_hash="$(echo -n "$repo_root" | md5 | cut -c1-4)"
  worktrees_dir="$HOME/.simtree/worktrees/\${repo_name}-\${short_hash}"
  if [[ -d "$worktrees_dir" ]]; then
    local -a dirs
    dirs=(\${worktrees_dir}/*(/:t))
    _describe 'worktree branch' dirs
  fi
}

_simtree_simulator_udids() {
  local -a sims
  if [[ -f "$HOME/.simtree/simulators.json" ]]; then
    sims=(\${(f)"$(python3 -c "
import json
with open('$HOME/.simtree/simulators.json') as f:
    for s in json.load(f):
        print(s['udid'] + ':' + s['name'])
" 2>/dev/null)"})
    _describe 'simulator' sims
  fi
}

_simtree_available_udids() {
  local -a sims
  sims=(\${(f)"$(xcrun simctl list devices available -j 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for rt, devs in data['devices'].items():
    for d in devs:
        if d.get('isAvailable'):
            print(d['udid'] + ':' + d['name'])
" 2>/dev/null)"})
  _describe 'simulator' sims
}

_simtree() {
  local -a commands
  commands=(
    'create:Create a worktree with automatic simulator assignment'
    'close:Remove a worktree and unlock its simulator'
    'list:List active worktrees with their assigned simulators'
    'simulator:Manage simulator pool'
    'completions:Manage shell completions'
    'help:Display help for command'
  )

  _arguments -C \\
    '-V[output the version number]' \\
    '--version[output the version number]' \\
    '-h[display help for command]' \\
    '--help[display help for command]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case "$state" in
    command)
      _describe 'command' commands
      ;;
    args)
      case "$words[1]" in
        create)
          _arguments '1:branch:_simtree_branches'
          ;;
        close)
          _arguments '1:worktree branch:_simtree_worktree_branches'
          ;;
        list)
          _arguments \\
            '-h[display help for command]' \\
            '--help[display help for command]'
          ;;
        simulator)
          local -a simulator_commands
          simulator_commands=(
            'add:Add a simulator to the pool'
            'remove:Remove a simulator from the pool'
            'list:Show all simulators and their lock status'
            'prune:Unlock simulators whose worktree no longer exists'
          )
          _arguments -C \\
            '1:simulator command:->simulator_command' \\
            '*::simulator arg:->simulator_args'
          case "$state" in
            simulator_command)
              _describe 'simulator command' simulator_commands
              ;;
            simulator_args)
              case "$words[1]" in
                add)
                  _arguments '1:udid:_simtree_available_udids'
                  ;;
                remove)
                  _arguments '1:udid:_simtree_simulator_udids'
                  ;;
              esac
              ;;
          esac
          ;;
        completions)
          local -a comp_commands
          comp_commands=(
            'install:Install zsh completions'
          )
          _describe 'completions command' comp_commands
          ;;
        help)
          _describe 'command' commands
          ;;
      esac
      ;;
  esac
}

_simtree "$@"
`

export const completionsCommand = new Command("completions")
  .description("Install zsh completions")
  .action(() => {
    const completionsDir = path.join(os.homedir(), ".zfunc")
    const targetFile = path.join(completionsDir, "_simtree")

    fs.mkdirSync(completionsDir, { recursive: true })
    fs.writeFileSync(targetFile, ZSH_COMPLETION)
    console.log(`Zsh completions installed to ${targetFile}`)
    console.log("Restart your shell or run:")
    console.log("  rm -rf ~/.zcompdump* && exec zsh")
  })
