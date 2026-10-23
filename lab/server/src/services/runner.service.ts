import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { SandboxService } from './sandbox.service.js';
import { DiffService } from './diff.service.js';
import { MetricsService } from './metrics.service.js';
import type { BenchmarkRunRequest, BenchmarkRunResult } from '../types/index.js';

export class RunnerService {
  constructor(
    private readonly sandboxService: SandboxService,
    private readonly metricsService: MetricsService,
    private readonly diffService: DiffService
  ) {}

  public async startBenchmark(
    req: BenchmarkRunRequest,
    archetypePath: string,
    sourceFramework: string
  ): Promise<BenchmarkRunResult> {
    const runId = `bench-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = new Date().toISOString();

    // 1. Create isolated sandbox
    const sandboxPath = this.sandboxService.createSandbox(runId, archetypePath);

    // 2. Save initial pending record
    const initialResult: BenchmarkRunResult = {
      runId,
      archetypeId: req.archetypeId,
      status: 'pending',
      startedAt,
    };
    this.metricsService.saveRun(initialResult);

    // 3. Spawn metamorph in the background — don't block the HTTP response
    this.executeMigration(runId, sandboxPath, archetypePath, sourceFramework, req);

    return initialResult;
  }

  public getRunStatus(runId: string): BenchmarkRunResult | null {
    return this.metricsService.getRunById(runId);
  }

  private async executeMigration(
    runId: string,
    sandboxPath: string,
    archetypePath: string,
    sourceFramework: string,
    req: BenchmarkRunRequest
  ): Promise<void> {
    const startMs = Date.now();

    // Update status to running
    this.metricsService.saveRun({
      runId,
      archetypeId: req.archetypeId,
      status: 'running',
      startedAt: new Date(startMs).toISOString(),
    });

    const cliPath = resolve(process.cwd(), 'packages/@nikelyh/cli/dist/index.js');
    const args = [
      cliPath,
      'run',
      sandboxPath,
      '--from', sourceFramework,
      '--to', req.targetFramework,
    ];

    if (req.useMockLLM) {
      args.push('--mock');
    }

    try {
      const { exitCode, stderr } = await this.spawnProcess('node', args);

      const durationMs = Date.now() - startMs;
      const completedAt = new Date().toISOString();

      // Count files modified by comparing sandbox against original archetype
      const diffs = this.diffService.compareDirectories(archetypePath, sandboxPath);
      const filesModifiedCount = diffs.length;

      if (exitCode === 0) {
        this.metricsService.saveRun({
          runId,
          archetypeId: req.archetypeId,
          status: 'completed',
          startedAt: new Date(startMs).toISOString(),
          completedAt,
          durationMs,
          filesModifiedCount,
          buildSuccess: true,
        });
      } else {
        this.metricsService.saveRun({
          runId,
          archetypeId: req.archetypeId,
          status: 'failed',
          startedAt: new Date(startMs).toISOString(),
          completedAt,
          durationMs,
          filesModifiedCount,
          buildSuccess: false,
          error: stderr.slice(0, 2000) || `Process exited with code ${exitCode}`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.metricsService.saveRun({
        runId,
        archetypeId: req.archetypeId,
        status: 'failed',
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        error: message.slice(0, 2000),
      });
    }
  }

  private spawnProcess(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}
