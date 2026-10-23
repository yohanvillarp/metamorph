import { Request, Response } from 'express';
import { RunnerService } from '../services/runner.service.js';
import { MetricsService } from '../services/metrics.service.js';
import { ArchetypesController } from './archetypes.controller.js';
import type { BenchmarkRunRequest } from '../types/index.js';

export class BenchmarkController {
  constructor(
    private readonly runnerService: RunnerService,
    private readonly metricsService: MetricsService,
    private readonly archetypesController: ArchetypesController
  ) {}

  public async startRun(req: Request, res: Response): Promise<void> {
    const body = req.body as BenchmarkRunRequest;
    if (!body || !body.archetypeId || !body.targetFramework) {
      res.status(400).json({ error: 'archetypeId and targetFramework are required' });
      return;
    }

    const archetype = this.archetypesController.getStaticArchetype(body.archetypeId);
    if (!archetype) {
      res.status(404).json({ error: `Unknown archetype: ${body.archetypeId}` });
      return;
    }

    try {
      const result = await this.runnerService.startBenchmark(body, archetype.path, archetype.sourceFramework);
      res.status(201).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  }

  public getRuns(_req: Request, res: Response): void {
    const runs = this.metricsService.getAllRuns();
    res.json({ runs });
  }

  public getRunById(req: Request, res: Response): void {
    const runId = String(req.params.runId || '');
    const run = this.metricsService.getRunById(runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  }
}
