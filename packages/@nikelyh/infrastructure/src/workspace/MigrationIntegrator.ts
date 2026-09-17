import fs from 'fs-extra';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { ShadowWorkspace } from './ShadowWorkspace';

export interface ApplyMigrationResult {
  message: string;
  gitUsed: boolean;
  branch?: string;
  backupPath?: string;
}

const COPY_IGNORED = ['node_modules', '.git', '.metamorph', 'dist', 'build', 'out', 'coverage', '.next'];

export function isCopyIgnored(itemName: string): boolean {
  if (COPY_IGNORED.includes(itemName)) return true;
  if (itemName === '.env' || itemName.startsWith('.env.')) return true;
  return false;
}

export class MigrationIntegrator {
  private shadowWorkspace: ShadowWorkspace;

  constructor(shadowWorkspace: ShadowWorkspace) {
    this.shadowWorkspace = shadowWorkspace;
  }

  /**
   * Applies the migrated code from the shadow workspace back to the target directory.
   * Requires a Git repository that actually versions the target (not a parent repo that gitignores it).
   */
  public async applyMigration(runId: string, targetPath: string): Promise<ApplyMigrationResult> {
    const shadowDir = this.shadowWorkspace.getShadowPath(runId);
    
    if (!fs.existsSync(shadowDir)) {
      throw new Error(`Shadow run not found: ${shadowDir}`);
    }

    const resolvedTarget = path.resolve(process.cwd(), targetPath);
    const gitRoot = this.resolveGitRoot(resolvedTarget);
    if (!gitRoot) {
      throw new Error(
        'Metamorph apply requires a Git repository. Run this from a project that already has git (including monorepo packages whose .git lives in a parent folder). Nested git init is not supported.'
      );
    }

    // Defense against applying to scratch/playgrounds within Metamorph repository itself
    const rootPkgJson = path.join(gitRoot, 'package.json');
    if (fs.existsSync(rootPkgJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(rootPkgJson, 'utf-8'));
        const normalizedTarget = resolvedTarget.replace(/\\/g, '/');
        if (pkg.name === 'metamorph-monorepo' && normalizedTarget.includes('/scratch/')) {
          throw new Error(
            `BLOCKED: Cannot apply to "${resolvedTarget}" because it is inside the development scratch/ directory of the Metamorph repository. Use a standalone git repository for user project migrations.`
          );
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message.startsWith('BLOCKED:')) throw e;
      }
    }

    if (this.isIgnoredByGit(gitRoot, resolvedTarget)) {
      throw new Error(
        `Cannot apply via Git: "${resolvedTarget}" is ignored by the repository at "${gitRoot}" (.gitignore). Metamorph will not create branches on a parent repo for ignored sandboxes. Use a standalone git project, or a tracked package inside a monorepo.`
      );
    }

    return this.applyWithGit(runId, shadowDir, resolvedTarget, gitRoot, `metamorph/${runId}`);
  }

  /**
   * Walks up from targetPath via `git rev-parse --show-toplevel`.
   */
  public resolveGitRoot(targetPath: string): string | null {
    try {
      const root = this.git(['rev-parse', '--show-toplevel'], targetPath).trim();
      return root || null;
    } catch {
      return null;
    }
  }

  public isIgnoredByGit(gitRoot: string, targetPath: string): boolean {
    try {
      execFileSync('git', ['check-ignore', '-q', '--', targetPath], {
        cwd: gitRoot,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  private git(args: string[], cwd: string): string {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error: unknown) {
      const err = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
      const detail = [err.stderr, err.stdout, err.message]
        .map((part) => (Buffer.isBuffer(part) ? part.toString('utf-8') : part) || '')
        .filter(Boolean)
        .join('\n')
        .trim();
      throw new Error(`git ${args.join(' ')} failed: ${detail || 'unknown git error'}`);
    }
  }

  private async applyWithGit(
    runId: string,
    shadowDir: string,
    targetPath: string,
    gitRoot: string,
    branchName: string
  ): Promise<ApplyMigrationResult> {
    const relativeTarget = path.relative(gitRoot, targetPath).replace(/\\/g, '/');
    const addPath = relativeTarget === '' ? '.' : relativeTarget;

    // Ensure the target directory has no uncommitted changes before switching branches
    const dirtyStatus = this.git(['status', '--porcelain', '--', addPath], gitRoot).trim();
    if (dirtyStatus) {
      throw new Error(
        `Cannot apply migration: the target directory has uncommitted changes:\n${dirtyStatus}\nPlease commit or stash your changes before applying.`
      );
    }

    try {
      this.git(['checkout', '-B', branchName], gitRoot);
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`Failed to create/reset git branch ${branchName}: ${e.message}`);
      }
      throw new Error(`Failed to create/reset git branch ${branchName}: ${String(e)}`);
    }

    this.copyShadowToTarget(shadowDir, targetPath);

    try {
      try {
        this.git(['-c', 'advice.addIgnoredFile=false', 'add', '-A', '--', addPath], gitRoot);
      } catch (addError: unknown) {
        const detail = addError instanceof Error ? addError.message : String(addError);
        const ignoredOnly = /paths are ignored by one of your \.gitignore/i.test(detail)
          && !/not a git repository|index\.lock|permission denied|tell me who you are/i.test(detail);
        if (!ignoredOnly) {
          throw addError;
        }
      }
      this.git(
        ['-c', 'advice.addIgnoredFile=false', 'commit', '--allow-empty', '-m', `chore: apply metamorph ai migration (${runId})`],
        gitRoot
      );
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      if (/tell me who you are|user\.email|user\.name/i.test(detail)) {
        throw new Error(
          `Failed to commit to branch ${branchName}: Git user.name / user.email are not set. Run git config user.email and git config user.name in this repo, then retry apply.`
        );
      }
      throw new Error(`Failed to commit changes to branch ${branchName}: ${detail}`);
    }

    return {
      message: `Successfully applied migration via Git to branch: ${branchName}`,
      gitUsed: true,
      branch: branchName
    };
  }

  private copyShadowToTarget(shadowDir: string, targetPath: string) {
    if (fs.existsSync(targetPath)) {
      const targetItems = fs.readdirSync(targetPath);
      for (const item of targetItems) {
        if (isCopyIgnored(item)) continue;
        fs.removeSync(path.join(targetPath, item));
      }
    }

    const shadowItems = fs.readdirSync(shadowDir);
    for (const item of shadowItems) {
      if (isCopyIgnored(item)) continue;
      
      const itemSrc = path.join(shadowDir, item);
      const itemDest = path.join(targetPath, item);
      
      fs.copySync(itemSrc, itemDest, { overwrite: true });
    }
  }
}
