import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface DetectedTech {
  framework: string;
  confidence: number; // 0-100
  evidence: string[];
}

interface DetectionRule {
  framework: string;
  packageKeys: string[];       // keys to check in dependencies/devDependencies
  configFiles: string[];       // config files whose existence confirms usage
}

const DETECTION_RULES: DetectionRule[] = [
  {
    framework: 'express',
    packageKeys: ['express'],
    configFiles: [],
  },
  {
    framework: 'fastify',
    packageKeys: ['fastify'],
    configFiles: [],
  },
  {
    framework: 'nestjs',
    packageKeys: ['@nestjs/core', '@nestjs/common'],
    configFiles: ['nest-cli.json'],
  },
  {
    framework: 'koa',
    packageKeys: ['koa'],
    configFiles: [],
  },
  {
    framework: 'hapi',
    packageKeys: ['@hapi/hapi', 'hapi'],
    configFiles: [],
  },
  {
    framework: 'next',
    packageKeys: ['next'],
    configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
  },
  {
    framework: 'react',
    packageKeys: ['react'],
    configFiles: [],
  },
  {
    framework: 'vue',
    packageKeys: ['vue'],
    configFiles: ['vue.config.js'],
  },
  {
    framework: 'angular',
    packageKeys: ['@angular/core'],
    configFiles: ['angular.json'],
  },
  {
    framework: 'svelte',
    packageKeys: ['svelte'],
    configFiles: ['svelte.config.js', 'svelte.config.ts'],
  },
];

/**
 * Scans a project directory and detects which supported frameworks are in use.
 * Returns detected frameworks sorted by confidence (highest first).
 *
 * Detection is purely local (reads package.json + checks config files).
 * No AI tokens are consumed.
 */
export function detectTechnologies(projectPath: string): DetectedTech[] {
  const detected: DetectedTech[] = [];

  // ── 1. Read package.json ──────────────────────────────────────────
  const pkgPath = join(projectPath, 'package.json');
  let allDeps: Record<string, string> = {};

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
    } catch {
      // malformed package.json — skip dependency detection
    }
  }

  // ── 2. Evaluate each rule ─────────────────────────────────────────
  for (const rule of DETECTION_RULES) {
    let confidence = 0;
    const evidence: string[] = [];

    // Check package.json dependencies
    for (const key of rule.packageKeys) {
      if (allDeps[key]) {
        confidence += 60;
        evidence.push(`package.json: "${key}": "${allDeps[key]}"`);
      }
    }

    // Check config files
    for (const configFile of rule.configFiles) {
      if (existsSync(join(projectPath, configFile))) {
        confidence += 30;
        evidence.push(`config file: ${configFile}`);
      }
    }

    if (confidence > 0) {
      detected.push({
        framework: rule.framework,
        confidence: Math.min(confidence, 100),
        evidence,
      });
    }
  }

  // Sort by confidence descending
  detected.sort((a, b) => b.confidence - a.confidence);

  return detected;
}
