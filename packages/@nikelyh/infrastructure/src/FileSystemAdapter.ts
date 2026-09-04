/**
 * Secondary Adapter: Interactúa con el sistema de archivos físico.
 * Implementa un "Driven Port" (a definir en src/ports/driven/)
 */
import * as fs from 'fs/promises';

export class FileSystemAdapter {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, 'utf-8');
  }
}
