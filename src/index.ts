import { program } from "commander"
import { simCommand } from "./commands/sim.js"
import { createCommand } from "./commands/create.js"
import { closeCommand } from "./commands/close.js"

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version("0.1.0")

program.addCommand(simCommand)
program.addCommand(createCommand)
program.addCommand(closeCommand)

program.parse()
