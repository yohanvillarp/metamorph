import fs from 'fs-extra';
import { join, resolve } from 'path';

/**
 * The Shadow Workspace is a safe, isolated directory where Metamorph copies the target files
 * before running any migrations. Agents only mutate files inside this shadow workspace.
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

    // Copy everything from source to shadow
    fs.copySync(sourceDir, shadowDir, {
      filter: (src) => !src.includes('node_modules') && !src.includes('.git') && !src.includes('.metamorph'),
    });

    return shadowDir;
  }
}
