import { StateRepository, findMigrationCatalogEntry } from '@nikelyh/domain';

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

  app.get('/api/plans', async (_req: any, res: any) => {
    try {
      const plans = await store.getAllPlans();
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/events', async (_req: any, res: any) => {
    try {
      const events = await store.getEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/browse', async (req: any, res: any) => {
    try {
      const { readdirSync, statSync } = await import('node:fs');
      const { resolve, join, basename } = await import('node:path');
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/detect', async (req: any, res: any) => {
    try {
      const { detectTechnologies } = await import('../detector/TechDetector.js');
      const targetPath = req.query.path ? String(req.query.path) : '.';
      const detected = detectTechnologies(targetPath);
      
      res.json({
        detected,
        primary: detected.length > 0 ? detected[0].framework : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── CONTROL ENDPOINTS (new) ─────────────────────────────

  if (migrationRunner) {
    app.post('/api/migrations/start', async (req: any, res: any) => {
      try {
        const { targetPath, from, to } = req.body;
        if (!targetPath || !from || !to) {
          return res.status(400).json({
            error: 'Missing required fields: targetPath, from, to',
          });
        }
        
        const catalogEntry = findMigrationCatalogEntry(from, to);
        if (!catalogEntry) {
          return res.status(400).json({
            error: `Unsupported migration profile: ${from} -> ${to}. Please check the supported catalog.`,
          });
        }
        
        const result = await migrationRunner.startMigration({
          targetPath,
          from,
          to,
        });
        res.json({ ok: true, ...result });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/migrations/rollback', async (req: any, res: any) => {
      try {
        const { runId } = req.body;
        if (!runId) {
          return res.status(400).json({
            error: 'Missing required field: runId',
          });
        }
        await migrationRunner.rollbackMigration(runId);
        res.json({ ok: true, message: `Rolled back run: ${runId}` });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/migrations/reset', async (_req: any, res: any) => {
      try {
        await store.reset();
        res.json({ ok: true, message: 'Migration state reset successfully' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  return app;
}
