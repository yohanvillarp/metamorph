import { Command } from 'commander';
import chalk from 'chalk';
import { detectMonorepo, inspectProject } from '@nikelyh/infrastructure';

export async function executeDetectAction(targetPath?: string): Promise<void> {
  try {
    const resolved = targetPath || '.';
    const monorepo = detectMonorepo(resolved);
    if (monorepo.isMonorepo) {
      console.log(chalk.cyan(`\n📦 Monorepo Detected: ${monorepo.tool || 'workspaces'}`));
      console.log(chalk.gray(`Root: ${monorepo.rootPath}`));
      console.log(chalk.gray(`Workspace Packages (${monorepo.packages.length}):`));
      monorepo.packages.forEach((p) => console.log(`  • ${chalk.white(p.name)}: ${chalk.gray(p.relativePath)}`));
    }

    const profiles = inspectProject(resolved);
    if (profiles.length === 0) {
      console.log(chalk.yellow(`\nNo supported technologies detected.`));
      return;
    }

    console.log(chalk.blue(`\n🔍 Detected Technologies & Architecture:`));
    profiles.forEach((p) => {
      console.log(`\n  • ${chalk.bold.green(p.framework)} (Confidence: ${p.confidence}%)`);
      console.log(
        `    Category: ${chalk.cyan(p.category)} | Variant: ${chalk.cyan(p.variant)} | Bundler: ${chalk.cyan(p.bundler)} | Lang: ${chalk.cyan(p.language.toUpperCase())}`
      );
      if (p.subsumedDependencies.length > 0) {
        console.log(`    Subsumed Dependencies: ${chalk.yellow(p.subsumedDependencies.join(', '))}`);
      }
      console.log(`    Suggested Targets: ${chalk.magenta(p.suggestedTargets.join(', '))}`);
      console.log(`    Evidence: ${chalk.gray(p.evidence.join('; '))}`);
    });
    console.log('');
  } catch (error: unknown) {
    console.error(chalk.red(`❌ Detection failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

export function registerDetectCommand(program: Command): void {
  program
    .command('detect [path]')
    .description('Detect frameworks, architectural variants and monorepo structure in a directory')
    .action(executeDetectAction);
}
