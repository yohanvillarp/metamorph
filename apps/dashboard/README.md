# Metamorph Dashboard

Real-time monitoring interface for the Metamorph agent swarm. Built with React 18, Vite, and Tailwind CSS following [Feature-Sliced Design](https://feature-sliced.design/) conventions.

## Purpose

The Dashboard connects to the local Express REST API (served by `@nikelyh/infrastructure`) and provides live visibility into:

- **Overview Stats** -- Pending, in-progress, completed, and failed task counters with a time-series chart.
- **Swarm View** -- Per-file pipeline visualization showing each file's progression through queued, working, reviewing, and done stages.
- **Migration Queue** -- Filterable task list with status badges and error details.
- **Event Log** -- Reverse-chronological stream of all semantic events emitted by the swarm.
- **Migration Form** -- Start new migration runs with source/target framework selection.

## Architecture

```text
src/
    app/            Global setup, providers, router
    pages/          Route-level page components (DashboardPage)
    widgets/        Self-contained UI blocks (OverviewStats, LiveSwarm, MigrationQueue, EventLog)
    entities/       UI-specific domain types (MigrationPlan, Task)
    shared/         Design tokens, API client, reusable hooks
```

### Layer Dependency Rules (FSD)

`shared` --> `entities` --> `features` --> `widgets` --> `pages` --> `app`

Cross-imports within the same layer are not permitted.

## Development

The Dashboard is not run independently. It is started through the CLI:

```bash
metamorph ui
```

This launches the Express API server on port 9876 and serves the built Dashboard assets.

For development with hot-reload:

```bash
cd apps/dashboard
npm run dev
```

The Vite dev server starts on `http://localhost:5173` and proxies API calls to `http://localhost:9876`.

## Build

```bash
npm run build
```

The production bundle is output to `dist/` and automatically copied into the CLI package (`packages/@nikelyh/cli/dist/public`) during the monorepo build via Turborepo.

## Technology

| Dependency | Version | Purpose |
|---|---|---|
| React | 18 | UI rendering |
| Vite | 8 | Build tooling and dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Recharts | 2 | Time-series chart in Overview |
