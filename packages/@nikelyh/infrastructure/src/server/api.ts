import { StateRepository, findMigrationCatalogEntry } from '@nikelyh/domain';
import { MigrationIntegrator } from '../workspace/MigrationIntegrator.js';
import type { Request, Response } from 'express';

/**
 * Creates and configures the Express REST API server.
 * This module is framework-agnostic from the caller's perspective:
 * the CLI mounts it, the Dashboard consumes it.
 * 
 * @param store The StateRepository implementation (SQLite).
 * @param migrationRunner Optional MigrationRunner for control endpoints.
 * @returns The configured Express app (not yet listening).
 */
export async function createApiServer(
  store: StateRepository,
  migrationRunner?: any
) {
  const express = (await import('express')).default;
  const cors = (await import('cors')).default;

  const app = express();
  app.use(cors());
  app.use(express.json());

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
      const { detectTechnologies } = await import('../detector/TechDetector.js');
      const targetPath = req.query.path ? String(req.query.path) : '.';
      const detected = detectTechnologies(targetPath);
      
      res.json({
        detected,
        primary: detected.length > 0 ? detected[0].framework : null
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
        
        const catalogEntry = findMigrationCatalogEntry(from, to);
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
        const integrator = new MigrationIntegrator(migrationRunner.workspace);
        const message = await integrator.applyMigration(runId, targetPath);
        res.json({ ok: true, message });
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
    // Catch-all route for SPA
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  return app;
}
