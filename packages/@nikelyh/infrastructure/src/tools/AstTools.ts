import { Tool } from '@mozaik-ai/core';
import { Project } from 'ts-morph';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

// A shared ts-morph project instance for the tools
const project = new Project();

/**
 * Validates that a file path is within the allowed sandbox directory.
 * Prevents the LLM from writing to files outside the shadow workspace.
 */
function assertSandbox(filePath: string, sandboxDir?: string): string {
  const resolved = path.resolve(filePath);
  if (sandboxDir) {
    const resolvedSandbox = path.resolve(sandboxDir);
    if (!resolved.startsWith(resolvedSandbox)) {
      throw new Error(
        `BLOCKED: Path "${resolved}" is outside the sandbox "${resolvedSandbox}". ` +
        `All file operations must stay within the shadow workspace.`
      );
    }
  }
  return resolved;
}

export function createReadFileTool(sandboxDir?: string): Tool {
  return {
    type: 'function',
    name: 'read_file',
    description: 'Reads the content of a source file using ts-morph.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The absolute path to the file to read.' },
      },
      required: ['filePath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath }: { filePath: string }) => {
      const resolvedPath = assertSandbox(filePath, sandboxDir);

      if (!existsSync(resolvedPath)) {
        return { error: `File not found: ${resolvedPath}` };
      }
      
      let sourceFile = project.getSourceFile(resolvedPath);
      if (!sourceFile) {
        project.addSourceFileAtPath(resolvedPath);
        sourceFile = project.getSourceFileOrThrow(resolvedPath);
      } else {
        await sourceFile.refreshFromFileSystem();
      }
      
      return {
        filePath: resolvedPath,
        content: sourceFile.getFullText(),
      };
    },
  };
}

export function createWriteFileTool(sandboxDir?: string): Tool {
  return {
    type: 'function',
    name: 'write_file',
    description: 'Overwrites the content of a source file with the provided refactored code using ts-morph.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The absolute path to the file to modify.' },
        newContent: { type: 'string', description: 'The entire new source code to write to the file.' },
      },
      required: ['filePath', 'newContent'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath, newContent }: { filePath: string; newContent: string }) => {
      const resolvedPath = assertSandbox(filePath, sandboxDir);

      let sourceFile = project.getSourceFile(resolvedPath);
      if (!sourceFile) {
        if (existsSync(resolvedPath)) {
          project.addSourceFileAtPath(resolvedPath);
          sourceFile = project.getSourceFileOrThrow(resolvedPath);
        } else {
          sourceFile = project.createSourceFile(resolvedPath, '');
        }
      }
      
      sourceFile.replaceWithText(newContent);
      await sourceFile.save();
      
      return {
        success: true,
        message: `File ${resolvedPath} successfully updated.`,
      };
    },
  };
}

export function createRenameFileTool(sandboxDir?: string): Tool {
  return {
    type: 'function',
    name: 'rename_file',
    description: 'Renames a file in the project.',
    parameters: {
      type: 'object',
      properties: {
        oldPath: { type: 'string', description: 'Current absolute path of the file.' },
        newPath: { type: 'string', description: 'New absolute path for the file.' },
      },
      required: ['oldPath', 'newPath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
      const resolvedOld = assertSandbox(oldPath, sandboxDir);
      const resolvedNew = assertSandbox(newPath, sandboxDir);

      const { renameSync, existsSync: fsExists } = await import('node:fs');
      if (!fsExists(resolvedOld)) {
        return { error: `File not found: ${resolvedOld}` };
      }
      
      const { mkdirSync } = await import('node:fs');
      const { dirname } = await import('node:path');
      mkdirSync(dirname(resolvedNew), { recursive: true });

      renameSync(resolvedOld, resolvedNew);
      
      const sourceFile = project.getSourceFile(resolvedOld);
      if (sourceFile) {
        project.removeSourceFile(sourceFile);
        if (fsExists(resolvedNew)) {
          project.addSourceFileAtPath(resolvedNew);
        }
      }
      
      return { success: true, message: `File renamed from ${resolvedOld} to ${resolvedNew}.` };
    },
  };
}

export function createCreateFileTool(sandboxDir?: string): Tool {
  return {
    type: 'function',
    name: 'create_file',
    description: 'Creates a new file with the specified content.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute path of the new file to create.' },
        content: { type: 'string', description: 'The content of the new file.' },
      },
      required: ['filePath', 'content'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath, content }: { filePath: string; content: string }) => {
      const resolvedPath = assertSandbox(filePath, sandboxDir);

      const { writeFileSync, mkdirSync } = await import('node:fs');
      const { dirname } = await import('node:path');
      
      mkdirSync(dirname(resolvedPath), { recursive: true });
      writeFileSync(resolvedPath, content, 'utf-8');
      
      project.addSourceFileAtPath(resolvedPath);
      
      return { success: true, message: `File created at ${resolvedPath}.` };
    },
  };
}

export function createDeleteFileTool(sandboxDir?: string): Tool {
  return {
    type: 'function',
    name: 'delete_file',
    description: 'Deletes a file from the project.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute path of the file to delete.' },
      },
      required: ['filePath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath }: { filePath: string }) => {
      const resolvedPath = assertSandbox(filePath, sandboxDir);

      const { renameSync, existsSync: fsExists } = await import('node:fs');
      if (!fsExists(resolvedPath)) {
        return { error: `File not found: ${resolvedPath}` };
      }
      
      const obsoletePath = `${resolvedPath}.obsolete`;
      renameSync(resolvedPath, obsoletePath);
      
      const sourceFile = project.getSourceFile(resolvedPath);
      if (sourceFile) {
        project.removeSourceFile(sourceFile);
      }
      
      return { success: true, message: `File marked as obsolete at ${obsoletePath} instead of deleting.` };
    },
  };
}

export function createListDirectoryTool(sandboxDir?: string): Tool {
  return {
    type: 'function',
    name: 'list_directory',
    description: 'Lists files and folders in a directory inside the shadow workspace. Use this to find existing screens, entry files, or imports instead of guessing paths.',
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: 'Absolute directory path inside the shadow workspace.' },
      },
      required: ['dirPath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ dirPath }: { dirPath: string }) => {
      const resolvedPath = assertSandbox(dirPath, sandboxDir);
      const { readdirSync, statSync, existsSync: fsExists } = await import('node:fs');
      if (!fsExists(resolvedPath)) {
        return { error: `Directory not found: ${resolvedPath}` };
      }
      if (!statSync(resolvedPath).isDirectory()) {
        return { error: `Not a directory: ${resolvedPath}` };
      }
      const entries = readdirSync(resolvedPath, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .slice(0, 80)
        .map((entry) => ({
          name: entry.name,
          path: path.join(resolvedPath, entry.name),
          kind: entry.isDirectory() ? 'dir' : 'file',
        }));
      return { dirPath: resolvedPath, entries };
    },
  };
}
