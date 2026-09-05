import fs from 'fs-extra';
import { join, resolve } from 'path';

/**
 * The Shadow Workspace is a safe, isolated directory where Metamorph copies the target files
 * before running any migrations. Agents only mutate files inside this shadow workspace.
 * 
 * It also provides rollback capabilities by keeping track of the original source path
 * so migrations can be reverted cleanly.
 */
export class ShadowWorkspace {
  private baseDir: string;

  constructor(basePath: string = '.metamorph/shadow') {
    this.baseDir = resolve(process.cwd(), basePath);
  }

  /**
   * Clones a target directory into the shadow workspace.
   * @param targetPath The absolute or relative path to the directory to clone.
   * @param runId A unique identifier for this run (e.g. timestamp).
   * @returns The absolute path to the cloned directory inside the shadow workspace.
   */
  public cloneDirectory(targetPath: string, runId: string): string {
    const sourceDir = resolve(process.cwd(), targetPath);
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Target directory does not exist: ${sourceDir}`);
    }

    const shadowDir = join(this.baseDir, runId);
    
    // Ensure it's clean
    if (fs.existsSync(shadowDir)) {
      fs.emptyDirSync(shadowDir);
    }

    // Copy items individually to avoid 'Cannot copy to a subdirectory of itself' error
    // when targetPath is the current working directory.
    const ignoredDirs = ['node_modules', '.git', '.metamorph', 'dist', 'build', 'out', 'coverage', '.next'];
    const items = fs.readdirSync(sourceDir);
    for (const item of items) {
      if (ignoredDirs.includes(item)) {
        continue;
      }
      const itemSrc = join(sourceDir, item);
      const itemDest = join(shadowDir, item);
      fs.copySync(itemSrc, itemDest, {
        filter: (src) => !ignoredDirs.some(dir => src.includes(`/${dir}/`) || src.endsWith(`/${dir}`) || src.includes(`\\${dir}\\`) || src.endsWith(`\\${dir}`)),
      });
    }

    return shadowDir;
  }

  /**
   * Removes the shadow workspace for a given run, effectively
   * discarding any in-progress migration work.
   */
  public rollback(runId: string): void {
    const shadowDir = join(this.baseDir, runId);
    if (fs.existsSync(shadowDir)) {
      fs.removeSync(shadowDir);
    }
  }

  /**
   * Returns the absolute path of the shadow dir for a given runId.
   */
  public getShadowPath(runId: string): string {
    return join(this.baseDir, runId);
  }

  /**
   * Cleans up old shadow runs to save disk space, keeping only the specified number of most recent runs.
   * @param keepCount Number of recent runs to keep (default: 3)
   */
  public cleanupOldRuns(keepCount: number = 3): void {
    if (!fs.existsSync(this.baseDir)) return;
    
    const runs = fs.readdirSync(this.baseDir)
      .filter(f => f.startsWith('run_') && fs.statSync(join(this.baseDir, f)).isDirectory());
      
    // Sort chronologically (run_<timestamp>), oldest first
    runs.sort();
    
    if (runs.length > keepCount) {
      const toDelete = runs.slice(0, runs.length - keepCount);
      for (const run of toDelete) {
        this.rollback(run);
      }
    }
  }
}
