import { Tool } from '@mozaik-ai/core';
import { Project, DiagnosticCategory } from 'ts-morph';
import * as path from 'path';

/**
 * Creates a tool to check TypeScript diagnostics in the shadow workspace.
 * Filters out external module errors (node_modules missing) since we don't install them during migration.
 */
export const createCheckProjectDiagnosticsTool = (shadowBase: string): Tool => ({
  name: 'check_project_diagnostics',
  description: 'Checks the project for TypeScript errors like broken imports/exports. Call this to see if the project has cross-file integration issues. Returns a list of errors.',
  parameters: {
    type: 'object',
    properties: {}, // No params needed, it checks the whole shadow workspace
  },
  execute: async () => {
    try {
      const tsConfigPath = path.join(shadowBase, 'tsconfig.json');
      let project: Project;
      
      try {
        project = new Project({
          tsConfigFilePath: tsConfigPath,
          skipAddingFilesFromTsConfig: false,
        });
      } catch (err) {
        // Fallback if tsconfig is missing or malformed
        project = new Project();
      }

      // Also add any loose files in src/ if tsconfig doesn't capture them
      project.addSourceFilesAtPaths(path.join(shadowBase, 'src/**/*.ts'));
      project.addSourceFilesAtPaths(path.join(shadowBase, 'src/**/*.tsx'));

      const diagnostics = project.getPreEmitDiagnostics();
      
      const relevantErrors = diagnostics.filter(d => {
        const code = d.getCode();
        // Ignore "Cannot find module 'react'" etc. (TS2307) IF it's an external module.
        // We can't easily tell if it's external, but usually local modules start with '.' or '/' or '@/'
        const message = d.getMessageText().toString();
        
        // TS2304: Cannot find name
        // TS2305: Module has no exported member
        // TS2306: File is not a module
        // TS2307: Cannot find module (we keep this only if it looks like a local path)
        // TS2614: Module has no exported member
        // TS2792: Cannot find module
        // TS2786: Cannot be used as a JSX component
        // TS17004: Cannot use JSX unless the '--jsx' flag is provided (ignore this, often happens if no tsconfig)
        if (code === 17004) return false;

        if (code === 2307 || code === 2792) {
          if (message.includes("'.") || message.includes("'/") || message.includes("'@/")) {
            return true;
          }
          return false; // external package
        }
        
        // Keep other relevant codes
        if ([2304, 2305, 2306, 2614, 2552, 2322, 2786].includes(code)) {
          return true;
        }
        
        return false;
      });

      if (relevantErrors.length === 0) {
        return "No local import/export errors found! The project integration looks solid.";
      }

      const formattedErrors = relevantErrors.map(d => {
        const file = d.getSourceFile();
        const line = file && d.getStart() ? file.getLineAndColumnAtPos(d.getStart()).line : 'unknown';
        const filePath = file ? path.relative(shadowBase, file.getFilePath()) : 'unknown path';
        return `[TS${d.getCode()}] ${filePath}:${line} - ${d.getMessageText().toString()}`;
      }).join('\n');

      return `Found ${relevantErrors.length} integration errors:\n${formattedErrors}`;
    } catch (e: any) {
      return `Failed to run diagnostics: ${e.message}. Note: if tsconfig.json is missing, you may need to check files manually.`;
    }
  }
});
