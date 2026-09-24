---
name: metamorph-guide
description: Quick reference, commands, debugging, and development guide for Metamorph.
---

# Metamorph Development & Debugging Guide

This skill provides instructions for working with, running, testing, and debugging Metamorph.

## 1. Quick Commands Reference

### Building the monorepo
```bash
npm run build
```

### Running development mode
```bash
npm run dev
```

### Running the CLI directly from source
```bash
# In packages/@nikelyh/cli
npm run dev -- run ./path/to/project --from express --to fastify
```

### Starting the Web UI Dashboard
```bash
npm run dev -- ui
```

## 2. Inspecting Local SQLite State
Metamorph stores all migration state and semantic events in `.metamorph/history.db`.
You can query it using node or sqlite tools:
- Plans: `SELECT * FROM plans;`
- Tasks: `SELECT plan_id, file_path, status, error FROM tasks;`
- Events: `SELECT id, event_name, timestamp FROM events ORDER BY id DESC LIMIT 50;`

## 3. Investigating Shadow Workspaces
When a migration runs:
- Shadow workspace lives in `.metamorph/shadow/<runId>`.
- You can inspect files, logs, and generated `MIGRATION.md` directly inside that directory.
- Discarding an unapplied migration:
```bash
metamorph rollback <runId>
```

## 4. Resetting History
To clear all past migrations and database events:
```bash
metamorph reset
```

## 5. Git Flow & Pull Request Templates
When completing a task or preparing a PR:
1. Target the **`develop`** branch (never `main`).
2. Write Conventional Commits: `<type>(<scope>): <description>`.
3. Choose the corresponding specialized PR template from `.github/PULL_REQUEST_TEMPLATE/`:
   - `feature.md`: New capabilities (PIE, polymorphic PM, CLI features).
   - `bugfix.md`: Bug fixes with RCA, environment, and regression tests.
   - `migration_target.md`: Framework migration pairs (`resolveMigrationCatalog`).
   - `swarm_agent.md`: Mozaik v4 agents, lifecycle (`leave()`), and prompts.
   - `dashboard_ui.md`: Web dashboard, FSD, zero-emoji, and Lucide icons.
   - `architecture.md`: Structural refactors and SQLite auto-migrations.
   - `perf_optimization.md`: Bottlenecks, profiling, and benchmark comparisons.
   - `PULL_REQUEST_TEMPLATE.md`: General/default fallback.

