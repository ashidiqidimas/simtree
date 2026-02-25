import { program } from "commander"
import { simulatorCommand } from "./commands/simulator.js"
import { createCommand } from "./commands/create.js"
import { closeCommand } from "./commands/close.js"
import { listCommand } from "./commands/list.js"
import { completionsCommand } from "./commands/completions.js"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.addCommand(simulatorCommand)
program.addCommand(createCommand)
program.addCommand(closeCommand)
program.addCommand(listCommand)
program.addCommand(completionsCommand)

program.parse()
