import fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';
import { ShadowWorkspace } from './ShadowWorkspace';

export class MigrationIntegrator {
  private shadowWorkspace: ShadowWorkspace;

  constructor(shadowWorkspace: ShadowWorkspace) {
    this.shadowWorkspace = shadowWorkspace;
  }

  /**
   * Applies the migrated code from the shadow workspace back to the target directory.
   * Prioritizes Git if available, otherwise falls back to a Zip backup.
   * 
   * @param runId The ID of the migration run to apply.
   * @param targetPath The original target path of the project.
   */
  public async applyMigration(runId: string, targetPath: string): Promise<string> {
    const shadowDir = this.shadowWorkspace.getShadowPath(runId);
    
    if (!fs.existsSync(shadowDir)) {
      throw new Error(`Shadow run not found: ${shadowDir}`);
    }

    const resolvedTarget = path.resolve(process.cwd(), targetPath);

    if (this.isGitRepo(resolvedTarget)) {
      return this.applyWithGit(runId, shadowDir, resolvedTarget);
    } else {
      return this.applyWithZipFallback(runId, shadowDir, resolvedTarget);
    }
  }

  private isGitRepo(targetPath: string): boolean {
    return fs.existsSync(path.join(targetPath, '.git'));
  }

  private async applyWithGit(runId: string, shadowDir: string, targetPath: string): Promise<string> {
    const branchName = `metamorph/${runId}`;
    
    // 1. Create a new branch (or reset if it already exists)
    try {
      execSync(`git checkout -B ${branchName}`, { cwd: targetPath, stdio: 'ignore' });
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`Failed to create/reset git branch ${branchName}: ${e.message}`);
      }
      throw new Error(`Failed to create/reset git branch ${branchName}: ${String(e)}`);
    }

    // 2. Overwrite files
    this.copyShadowToTarget(shadowDir, targetPath);

    // 3. Commit changes
    try {
      execSync(`git add .`, { cwd: targetPath, stdio: 'ignore' });
      // Use --allow-empty in case the user applies the exact same migration twice
      execSync(`git commit --allow-empty -m "chore: apply metamorph ai migration (${runId})"`, { cwd: targetPath, stdio: 'ignore' });
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`Failed to commit changes to branch ${branchName}: ${e.message}`);
      }
      throw new Error(`Failed to commit changes to branch ${branchName}: ${String(e)}`);
    }

    return `Successfully applied migration via Git to branch: ${branchName}`;
  }

  private async applyWithZipFallback(runId: string, shadowDir: string, targetPath: string): Promise<string> {
    // For now, since adm-zip/archiver is not installed, we will just copy to a backup folder.
    const backupDir = path.resolve(os.tmpdir(), 'metamorph_backups', `${runId}_backup`);
    
    fs.ensureDirSync(backupDir);
    
    // Backup original
    fs.copySync(targetPath, backupDir, {
      filter: (src) => !src.includes('node_modules') && !src.includes('.git') && !src.includes('.metamorph'),
    });

    // Overwrite target
    this.copyShadowToTarget(shadowDir, targetPath);

    return `Successfully applied migration. Git was not detected, so a backup was saved at: ${backupDir}`;
  }

  private copyShadowToTarget(shadowDir: string, targetPath: string) {
    const ignoredDirs = ['node_modules', '.git', '.metamorph'];
    
    // 1. Clean the target directory first to ensure deleted files are removed
    if (fs.existsSync(targetPath)) {
      const targetItems = fs.readdirSync(targetPath);
      for (const item of targetItems) {
        if (ignoredDirs.includes(item)) continue;
        fs.removeSync(path.join(targetPath, item));
      }
    }

    // 2. Copy everything from the shadow directory
    const shadowItems = fs.readdirSync(shadowDir);
    for (const item of shadowItems) {
      if (ignoredDirs.includes(item)) continue;
      
      const itemSrc = path.join(shadowDir, item);
      const itemDest = path.join(targetPath, item);
      
      fs.copySync(itemSrc, itemDest, { overwrite: true });
    }
  }
}
