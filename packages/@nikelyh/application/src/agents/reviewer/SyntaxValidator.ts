export interface SyntaxValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Performs pre-LLM static syntax checking using ts-morph diagnostics.
 */
export async function validateTypeScriptSyntax(filePath: string): Promise<SyntaxValidationResult> {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return { isValid: true };
  }

  try {
    const { Project } = await import('ts-morph');
    const tsProject = new Project();
    const sf = tsProject.addSourceFileAtPath(filePath);
    const diagnostics = sf.getPreEmitDiagnostics();
    const syntaxErrors = diagnostics.filter((d) => d.getCode() >= 1000 && d.getCode() < 2000);

    if (syntaxErrors.length > 0) {
      return {
        isValid: false,
        errors: syntaxErrors.map((d) => `TS${d.getCode()}: ${d.getMessageText()}`),
      };
    }
  } catch (error: unknown) {
    console.warn(`[SyntaxValidator] Failed to run syntax check on ${filePath}:`, error);
  }

  return { isValid: true };
}
