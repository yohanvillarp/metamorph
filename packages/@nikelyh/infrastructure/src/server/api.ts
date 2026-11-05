import { StateRepository, resolveMigrationCatalog, getSupportedFrameworks, getSupportedMigrations } from '@nikelyh/domain';
import { MigrationIntegrator } from '../workspace/MigrationIntegrator.js';
import { MigrationEventStream } from './MigrationEventStream.js';
import type { Request, Response } from 'express';

/**
 * Creates and configures the Express REST API server.
 * This module is framework-agnostic from the caller's perspective:
 * the CLI mounts it, the Dashboard consumes it.
 *
 * @param store The StateRepository implementation (SQLite). Wrap it in
 *   EventEmittingStateRepository sharing `eventStream` so that writes made by
 *   the MigrationRunner are pushed to SSE clients as well.
 * @param migrationRunner Optional MigrationRunner for control endpoints.
 * @param eventStream Broadcaster backing GET /api/events/stream.
 * @returns The configured Express app (not yet listening).
 */
export async function createApiServer(
  store: StateRepository,
  migrationRunner?: any,
  eventStream: MigrationEventStream = new MigrationEventStream()
) {
  const express = (await import('express')).default;
  const cors = (await import('cors')).default;

  const app = express();
  app.use(cors());
  app.use(express.json());

  // ─── SSE EVENT STREAM ─────────────────────────────────────

  app.get('/api/events/stream', (_req: Request, res: Response) => {
    eventStream.addClient(res);
  });

  // ─── READ ENDPOINTS (existing) ───────────────────────────

  app.get('/api/plans', async (_req: Request, res: Response) => {
    try {
      const plans = await store.getAllPlans();
      res.json(plans);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  app.get('/api/events', async (_req: Request, res: Response) => {
    try {
      const events = await store.getEvents();
      res.json(events);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  app.get('/api/cost/:runId', async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.runId);
      const summary = await store.getCostSummary(runId);
      res.json(summary);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  app.get('/api/browse', async (req: Request, res: Response) => {
    try {
      const { readdirSync, statSync } = await import('node:fs');
      const { resolve, join } = await import('node:path');
      const targetPath = req.query.path
        ? resolve(String(req.query.path))
        : resolve('.');

      const entries = readdirSync(targetPath)
        .filter((name: string) =>
          !name.startsWith('.') &&
          name !== 'node_modules' &&
          name !== 'dist' &&
          name !== 'build'
        )
        .map((name: string) => {
          const full = join(targetPath, name);
          try {
            const stat = statSync(full);
            return {
              name,
              path: full,
              isDirectory: stat.isDirectory(),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      res.json({
        current: targetPath,
        parent: resolve(targetPath, '..'),
        entries,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  app.get('/api/detect', async (req: Request, res: Response) => {
    try {
      const { detectTechnologies, inspectProject, detectMonorepo } = await import('../detector/ProjectDetector.js');
      const targetPath = req.query.path ? String(req.query.path) : '.';
      const monorepo = detectMonorepo(targetPath);
      const profiles = inspectProject(targetPath);
      const detected = detectTechnologies(targetPath);
      
      res.json({
        detected,
        profiles,
        monorepo: monorepo.isMonorepo ? monorepo : null,
        primary: profiles.length > 0 ? profiles[0].framework : null
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  app.get('/api/catalogs/supported', async (_req: Request, res: Response) => {
    try {
      res.json({
        frameworks: getSupportedFrameworks(),
        migrations: getSupportedMigrations(),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  // ─── SHADOW DIFF ENDPOINTS ─────────────────────────────

  const IGNORED_DIRS = ['node_modules', '.git', '.metamorph', 'dist', 'build', 'out', 'coverage', '.next', '.turbo'];

  app.get('/api/shadow/:runId/files', async (req: Request, res: Response) => {
    try {
      const { readdirSync, readFileSync, statSync, existsSync } = await import('node:fs');
      const { resolve, join, relative, sep } = await import('node:path');

      const runId = String(req.params.runId);
      if (/[/\\]|\.\./.test(runId)) {
        res.status(400).json({ error: 'Invalid run ID' });
        return;
      }
      const shadowBase = resolve('.metamorph/shadow');
      const shadowDir = join(shadowBase, runId);

      if (!existsSync(shadowDir)) {
        res.status(404).json({ error: `Shadow workspace not found for run: ${runId}` });
        return;
      }

      // Find the original targetPath from the plan
      const plans = await store.getAllPlans();
      const plan = plans.find((p) => p.runId === runId);
      const originalDir = plan?.targetPath ? resolve(plan.targetPath) : null;

      const files: Array<{ path: string; status: 'added' | 'modified' | 'deleted' }> = [];
      const MAX_COMPARE_SIZE = 2 * 1024 * 1024; // 2 MB — skip content comparison for larger files

      function walkDir(dir: string, base: string) {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          if (IGNORED_DIRS.includes(entry)) continue;
          const full = join(dir, entry);
          const rel = relative(base, full);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            walkDir(full, base);
          } else {
            const origPath = originalDir ? join(originalDir, rel) : null;
            const originalExists = origPath ? existsSync(origPath) : false;
            if (!originalExists) {
              files.push({ path: rel, status: 'added' });
            } else if (stat.size <= MAX_COMPARE_SIZE) {
              // Compare file contents to avoid marking unchanged files as modified
              const shadowContent = readFileSync(full);
              const origContent = readFileSync(origPath!);
              if (!shadowContent.equals(origContent)) {
                files.push({ path: rel, status: 'modified' });
              }
            } else {
              // Large file — compare by size as a heuristic
              const origStat = statSync(origPath!);
              if (stat.size !== origStat.size) {
                files.push({ path: rel, status: 'modified' });
              }
            }
          }
        }
      }

      walkDir(shadowDir, shadowDir);

      // Check for deleted files (in original but not in shadow)
      if (originalDir && existsSync(originalDir)) {
        function walkOriginal(dir: string, base: string) {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            if (IGNORED_DIRS.includes(entry)) continue;
            const full = join(dir, entry);
            const rel = relative(base, full);
            const stat = statSync(full);
            if (stat.isDirectory()) {
              walkOriginal(full, base);
            } else if (!existsSync(join(shadowDir, rel))) {
              files.push({ path: rel, status: 'deleted' });
            }
          }
        }
        walkOriginal(originalDir, originalDir);
      }

      res.json({ runId, files });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  app.get('/api/shadow/:runId/diff', async (req: Request, res: Response) => {
    try {
      const { readFileSync, statSync, existsSync } = await import('node:fs');
      const { resolve, join, sep } = await import('node:path');

      const runId = String(req.params.runId);
      if (/[/\\]|\.\./.test(runId)) {
        res.status(400).json({ error: 'Invalid run ID' });
        return;
      }
      const filePath = String(req.query.file || '');
      if (!filePath) {
        res.status(400).json({ error: 'Missing required query parameter: file' });
        return;
      }

      const shadowBase = resolve('.metamorph/shadow');
      const shadowDir = join(shadowBase, runId);
      const shadowFile = resolve(shadowDir, filePath);

      // Path traversal guard — resolved path must stay within the shadow directory
      if (!shadowFile.startsWith(shadowDir + sep)) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      const plans = await store.getAllPlans();
      const plan = plans.find((p) => p.runId === runId);
      const originalDir = plan?.targetPath ? resolve(plan.targetPath) : null;
      const originalFile = originalDir ? resolve(originalDir, filePath) : null;

      // Guard original file path traversal too
      if (originalFile && originalDir && !originalFile.startsWith(originalDir + sep)) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      const MAX_DIFF_SIZE = 5 * 1024 * 1024; // 5 MB

      let shadowContent: string | null = null;
      if (existsSync(shadowFile)) {
        const size = statSync(shadowFile).size;
        shadowContent = size <= MAX_DIFF_SIZE ? readFileSync(shadowFile, 'utf-8') : '[File too large to display]';
      }

      let originalContent: string | null = null;
      if (originalFile && existsSync(originalFile)) {
        const size = statSync(originalFile).size;
        originalContent = size <= MAX_DIFF_SIZE ? readFileSync(originalFile, 'utf-8') : '[File too large to display]';
      }

      res.json({
        file: filePath,
        original: originalContent,
        modified: shadowContent,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: String(error) });
      }
    }
  });

  // ─── CONTROL ENDPOINTS (new) ─────────────────────────────

  if (migrationRunner) {
    app.post('/api/migrations/start', async (req: Request, res: Response): Promise<void> => {
      try {
        const { targetPath, from, to } = req.body;
        if (!targetPath || !from || !to) {
          res.status(400).json({
            error: 'Missing required fields: targetPath, from, to',
          });
          return;
        }
        
        const catalogEntry = resolveMigrationCatalog(from, to);
        if (!catalogEntry) {
          res.status(400).json({
            error: `Unsupported migration profile: ${from} -> ${to}. Please check the supported catalog.`,
          });
          return;
        }
        
        const result = await migrationRunner.startMigration({
          targetPath,
          from,
          to,
        });
        res.json({ ok: true, ...result });
      } catch (error: unknown) {
        if (error instanceof Error) {
          res.status(500).json({ error: error.message });
        } else {
          res.status(500).json({ error: String(error) });
        }
      }
    });

    app.post('/api/migrations/apply', async (req: Request, res: Response): Promise<void> => {
      try {
        const { runId, targetPath } = req.body;
        if (!runId || !targetPath) {
          res.status(400).json({
            error: 'Missing required fields: runId, targetPath',
          });
          return;
        }

        const plans = await store.getAllPlans();
        const plan = plans.find((item) => item.runId === runId);
        if (!plan) {
          res.status(404).json({ error: `Plan for run "${runId}" not found in database.` });
          return;
        }

        if (plan.phase !== 'completed' || plan.outcome !== 'success') {
          res.status(400).json({
            error: `Cannot apply migration: plan is not completed successfully (phase: "${plan.phase}", outcome: "${plan.outcome || 'none'}"). Only successful migrations can be applied.`,
          });
          return;
        }

        if (plan.appliedAt) {
          res.status(400).json({
            error: `Migration for run "${runId}" has already been applied at ${new Date(plan.appliedAt).toISOString()} to branch ${plan.appliedBranch || 'unknown'}.`,
          });
          return;
        }

        const integrator = new MigrationIntegrator(migrationRunner.workspace);
        const result = await integrator.applyMigration(runId, targetPath);
        plan.appliedAt = new Date();
        plan.appliedBranch = result.branch;
        await store.savePlan(plan);
        await store.logEvent('migration.applied', { runId, branch: result.branch, targetPath });
        res.json({ ok: true, ...result });
      } catch (error: unknown) {
        if (error instanceof Error) {
          res.status(500).json({ error: error.message });
        } else {
          res.status(500).json({ error: String(error) });
        }
      }
    });

    app.post('/api/migrations/rollback', async (req: Request, res: Response): Promise<void> => {
      try {
        const { runId } = req.body;
        if (!runId) {
          res.status(400).json({
            error: 'Missing required field: runId',
          });
          return;
        }
        await migrationRunner.rollbackMigration(runId);
        res.json({ ok: true, message: `Rolled back run: ${runId}` });
      } catch (error: unknown) {
        if (error instanceof Error) {
          res.status(500).json({ error: error.message });
        } else {
          res.status(500).json({ error: String(error) });
        }
      }
    });

    app.post('/api/migrations/reset', async (_req: Request, res: Response) => {
      try {
        await store.reset();
        res.json({ ok: true, message: 'Migration state reset successfully' });
      } catch (error: unknown) {
        if (error instanceof Error) {
          res.status(500).json({ error: error.message });
        } else {
          res.status(500).json({ error: String(error) });
        }
      }
    });
  }

  // ─── STATIC SPA SERVING ──────────────────────────────────
  const path = await import('node:path');
  const fs = await import('node:fs');
  
  let publicDir = path.join(import.meta.dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    publicDir = path.join(import.meta.dirname, '../public');
  }

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // Catch-all route for SPA (Express v5 requires RegExp instead of string wildcards)
    app.get(/^(.*)$/, (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  return app;
}
