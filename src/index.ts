import { createRequire } from "node:module"
import { program } from "commander"
import { simulatorCommand } from "./commands/simulator.js"
import { createCommand } from "./commands/create.js"
import { closeCommand } from "./commands/close.js"
import { moveCommand } from "./commands/move.js"
import { doneCommand } from "./commands/done.js"
import { listCommand } from "./commands/list.js"
import { completionsCommand } from "./commands/completions.js"

const require = createRequire(import.meta.url)
const { version } = require("../package.json")

program
  .name("simtree")
  .description("Manage git worktrees with automatic iOS simulator assignment")
  .version(version)

program.addCommand(simulatorCommand)
program.addCommand(createCommand)
program.addCommand(closeCommand)
program.addCommand(moveCommand)
program.addCommand(doneCommand)
program.addCommand(listCommand)
program.addCommand(completionsCommand)

program.parse()
