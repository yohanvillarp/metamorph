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
