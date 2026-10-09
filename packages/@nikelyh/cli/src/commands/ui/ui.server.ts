import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import {
  SQLiteStateStore,
  createReadFileTool,
  createWriteFileTool,
  createRenameFileTool,
  createCreateFileTool,
  createDeleteFileTool,
  createListDirectoryTool,
  createCheckProjectDiagnosticsTool,
  createRunBuildTool,
  createApiServer,
  ConfigStore,
} from '@nikelyh/infrastructure';
import { MigrationRunner } from '@nikelyh/application';
import { presentMissingApiKey } from '../run/run.presenter';

function createUiTools(shadowBase: string) {
  return [
    createReadFileTool(shadowBase),
    createWriteFileTool(shadowBase),
    createRenameFileTool(shadowBase),
    createCreateFileTool(shadowBase),
    createDeleteFileTool(shadowBase),
    createListDirectoryTool(shadowBase),
    createCheckProjectDiagnosticsTool(shadowBase),
    createRunBuildTool(shadowBase),
  ];
}

export async function startUiServer(desiredPort: number): Promise<void> {
  const spinner = ora('Starting Metamorph API server...').start();
  try {
    const getPort = (await import('get-port')).default;
    const open = (await import('open')).default;
    const port = await getPort({ port: desiredPort });

    const hasApiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!hasApiKey) {
      spinner.stop();
      presentMissingApiKey();
      process.exit(1);
    }

    const resolvedConfig = ConfigStore.resolveConfig();
    const store = new SQLiteStateStore('.metamorph');
    const shadowBase = path.resolve('.metamorph/shadow');
    const tools = createUiTools(shadowBase);
    const runner = new MigrationRunner(store, tools, resolvedConfig);
    const app = await createApiServer(store, runner);

    app.listen(port, () => {
      spinner.succeed(`Metamorph UI running on http://localhost:${port}`);
      console.log(chalk.blue(`\nEndpoints available:`));
      console.log(chalk.gray(`  GET  /api/plans`));
      console.log(chalk.gray(`  GET  /api/events`));
      console.log(chalk.gray(`  POST /api/migrations/start`));
      console.log(chalk.gray(`  POST /api/migrations/rollback`));
      open(`http://localhost:${port}`);
    });

    process.on('unhandledRejection', (reason) => {
      const msg = reason instanceof Error ? reason.message : String(reason);
      console.error(chalk.red(`\n[Metamorph UI] Background swarm error caught: ${msg}`));
      console.log(chalk.yellow(`[Metamorph UI] HTTP server remains active on http://localhost:${port}`));
    });

    process.on('uncaughtException', (error) => {
      console.error(chalk.red(`\n[Metamorph UI] Uncaught exception caught: ${error.message}`));
      console.log(chalk.yellow(`[Metamorph UI] HTTP server remains active on http://localhost:${port}`));
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    spinner.fail(`Failed to start: ${errorMessage}`);
    process.exit(1);
  }
}
