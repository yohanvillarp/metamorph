import { Tool } from '@mozaik-ai/core';
import { Project } from 'ts-morph';
import { readFileSync, existsSync } from 'node:fs';

// A shared ts-morph project instance for the tools
const project = new Project();

export function createReadFileTool(): Tool {
  return {
    type: 'function',
    name: 'read_file',
    description: 'Reads the content of a source file using ts-morph.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The relative path to the file to read.' },
      },
      required: ['filePath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath }: { filePath: string }) => {
      if (!existsSync(filePath)) {
        return { error: `File not found: ${filePath}` };
      }
      
      let sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        project.addSourceFileAtPath(filePath);
        sourceFile = project.getSourceFileOrThrow(filePath);
      } else {
        // Refresh from disk in case it changed
        await sourceFile.refreshFromFileSystem();
      }
      
      return {
        filePath,
        content: sourceFile.getFullText(),
      };
    },
  };
}

export function createWriteFileTool(): Tool {
  return {
    type: 'function',
    name: 'write_file',
    description: 'Overwrites the content of a source file with the provided refactored code using ts-morph.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The relative path to the file to modify.' },
        newContent: { type: 'string', description: 'The entire new source code to write to the file.' },
      },
      required: ['filePath', 'newContent'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath, newContent }: { filePath: string; newContent: string }) => {
      let sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        if (existsSync(filePath)) {
          project.addSourceFileAtPath(filePath);
          sourceFile = project.getSourceFileOrThrow(filePath);
        } else {
          sourceFile = project.createSourceFile(filePath, '');
        }
      }
      
      sourceFile.replaceWithText(newContent);
      await sourceFile.save();
      
      return {
        success: true,
        message: `File ${filePath} successfully updated.`,
      };
    },
  };
}

export function createRenameFileTool(): Tool {
  return {
    type: 'function',
    name: 'rename_file',
    description: 'Renames a file in the project.',
    parameters: {
      type: 'object',
      properties: {
        oldPath: { type: 'string', description: 'Current relative path of the file.' },
        newPath: { type: 'string', description: 'New relative path for the file.' },
      },
      required: ['oldPath', 'newPath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
      const { renameSync, existsSync } = await import('node:fs');
      if (!existsSync(oldPath)) {
        return { error: `File not found: ${oldPath}` };
      }
      
      renameSync(oldPath, newPath);
      
      // Update ts-morph project if loaded
      const sourceFile = project.getSourceFile(oldPath);
      if (sourceFile) {
        project.removeSourceFile(sourceFile);
        if (existsSync(newPath)) {
          project.addSourceFileAtPath(newPath);
        }
      }
      
      return { success: true, message: `File renamed from ${oldPath} to ${newPath}.` };
    },
  };
}

export function createCreateFileTool(): Tool {
  return {
    type: 'function',
    name: 'create_file',
    description: 'Creates a new file with the specified content.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative path of the new file to create.' },
        content: { type: 'string', description: 'The content of the new file.' },
      },
      required: ['filePath', 'content'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath, content }: { filePath: string; content: string }) => {
      const { writeFileSync, mkdirSync } = await import('node:fs');
      const { dirname } = await import('node:path');
      
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
      
      project.addSourceFileAtPath(filePath);
      
      return { success: true, message: `File created at ${filePath}.` };
    },
  };
}

export function createDeleteFileTool(): Tool {
  return {
    type: 'function',
    name: 'delete_file',
    description: 'Deletes a file from the project.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative path of the file to delete.' },
      },
      required: ['filePath'],
      additionalProperties: false,
    },
    strict: true,
    invoke: async ({ filePath }: { filePath: string }) => {
      const { renameSync, existsSync } = await import('node:fs');
      if (!existsSync(filePath)) {
        return { error: `File not found: ${filePath}` };
      }
      
      const obsoletePath = `${filePath}.obsolete`;
      renameSync(filePath, obsoletePath);
      
      const sourceFile = project.getSourceFile(filePath);
      if (sourceFile) {
        project.removeSourceFile(sourceFile);
      }
      
      return { success: true, message: `File marked as obsolete at ${obsoletePath} instead of deleting.` };
    },
  };
}
