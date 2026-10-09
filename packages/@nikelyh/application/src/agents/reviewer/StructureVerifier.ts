import * as fs from 'node:fs';
import * as path from 'node:path';
import { MigrationPlan } from '@nikelyh/domain';
import { classifyMissingFile, ClassifyMissingFileResult } from '../../analysis/classifyMissingFile';
import { analyzeReactToNextStructure, findShadowRoot } from '../../analysis/NextMigrationHints';

export interface StructureVerificationResult {
  passed: boolean;
  isMissingApproved?: boolean;
  errors?: string[];
  reason?: string;
}

/**
 * Validates whether a missing file is an approved structural reorganization or illegal deletion.
 */
export function verifyMissingFile(filePath: string, plan?: MigrationPlan | null): StructureVerificationResult {
  if (fs.existsSync(filePath)) {
    return { passed: true };
  }

  const sourceFramework = plan?.profile.source || 'react';
  const targetFramework = plan?.profile.target || 'next';
  const shadowRoot = findShadowRoot(filePath);

  const classification: ClassifyMissingFileResult = classifyMissingFile({
    filePath,
    source: sourceFramework,
    target: targetFramework,
    shadowRoot,
    fileExists: fs.existsSync,
  });

  if (classification.verdict === 'approved') {
    return {
      passed: true,
      isMissingApproved: true,
      reason: classification.reason,
    };
  }

  return {
    passed: false,
    errors: classification.errors || ['File does not exist and has no demonstrable replacement'],
  };
}

/**
 * Validates App Router architectural integrity for React -> Next migrations.
 */
export function verifyAppRouterStructure(filePath: string, plan?: MigrationPlan | null): StructureVerificationResult {
  if (!plan) return { passed: true };

  const isReactToNext = plan.profile.source.toLowerCase() === 'react' && plan.profile.target.toLowerCase() === 'next';
  if (!isReactToNext) return { passed: true };

  const shadowRoot = findShadowRoot(filePath);
  if (!shadowRoot) return { passed: true };

  const current = path.resolve(filePath);
  const structureIssues = analyzeReactToNextStructure(shadowRoot).filter(
    (issue) => path.resolve(issue.filePath) === current
  );

  if (structureIssues.length > 0) {
    const errors = structureIssues.flatMap((issue) => issue.errors);
    return { passed: false, errors };
  }

  return { passed: true };
}
