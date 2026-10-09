#!/usr/bin/env node
import { Command } from 'commander';
import 'dotenv/config';
import {
  registerRunCommand,
  registerApplyCommand,
  registerRollbackCommand,
  registerResetCommand,
  registerDetectCommand,
  registerListCommand,
  registerUiCommand,
  registerConfigCommand,
} from './commands/index.js';

const program = new Command();

program
  .name('metamorph')
  .description('AI-powered technology migration tool using Mozaik Agents')
  .version('2.2.0');

registerRunCommand(program);
registerApplyCommand(program);
registerRollbackCommand(program);
registerResetCommand(program);
registerDetectCommand(program);
registerListCommand(program);
registerUiCommand(program);
registerConfigCommand(program);

program.parse(process.argv);
