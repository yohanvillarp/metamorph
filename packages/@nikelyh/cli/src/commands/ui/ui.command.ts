import { Command } from 'commander';
import { logStartupContext } from '../run/run.presenter';
import { startUiServer } from './ui.server';

export function registerUiCommand(program: Command): void {
  program
    .command('ui')
    .description('Start the Metamorph Dashboard API server')
    .option('-p, --port <number>', 'Port for the API server', '9876')
    .action(async (options: { port: string }) => {
      logStartupContext();
      const desiredPort = parseInt(options.port, 10);
      await startUiServer(desiredPort);
    });
}
