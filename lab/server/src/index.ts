import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { SandboxService } from './services/sandbox.service.js';
import { MetricsService } from './services/metrics.service.js';
import { RunnerService } from './services/runner.service.js';
import { DiffService } from './services/diff.service.js';

import { ArchetypesController } from './controllers/archetypes.controller.js';
import { BenchmarkController } from './controllers/benchmark.controller.js';
import { CompareController } from './controllers/compare.controller.js';

const app = express();
const port = process.env.LAB_SERVER_PORT || 4200;

app.use(cors());
app.use(express.json());

// Services
const sandboxService = new SandboxService();
const metricsService = new MetricsService();
const diffService = new DiffService();
const runnerService = new RunnerService(sandboxService, metricsService, diffService);

// Controllers
const archetypesController = new ArchetypesController();
const benchmarkController = new BenchmarkController(runnerService, metricsService, archetypesController);
const compareController = new CompareController(diffService, sandboxService, archetypesController);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '@metamorph-lab/server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Archetypes
app.get('/api/archetypes', (req, res) => archetypesController.listArchetypes(req, res));
app.get('/api/archetypes/:id', (req, res) => archetypesController.getArchetypeById(req, res));

// Benchmarks
app.post('/api/benchmark/run', (req, res) => benchmarkController.startRun(req, res));
app.get('/api/benchmark/runs', (req, res) => benchmarkController.getRuns(req, res));
app.get('/api/benchmark/runs/:runId', (req, res) => benchmarkController.getRunById(req, res));

// Compare
app.get('/api/compare', (req, res) => compareController.getDiff(req, res));

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`[Metamorph Lab Server] Listening at http://localhost:${port}`);
  });
}

export { app };
