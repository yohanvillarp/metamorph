---
name: Metamorph Architectural Invariants & Guidelines
description: Core architectural principles, boundary rules, and constraints of the Metamorph codebase.
---

# Metamorph Architecture Guidelines

When developing, refactoring, or extending Metamorph, adhere to these fundamental architectural invariants:

## 1. Hexagonal Layer Separation
- **`domain`** must remain 100% free of I/O, database dependencies, Express, ts-morph, and Mozaik SDK imports. It contains only pure entities, event types, catalog rules, and interfaces (ports).
- **`application`** coordinates business use cases and agents using `@mozaik-ai/core` and `@nikelyh/domain`. It consumes ports via dependency injection from the CLI or infrastructure bootstrap.
- **`infrastructure`** implements ports: `SQLiteStateStore` (persistence), `ShadowWorkspace` (disk cloning), `MigrationIntegrator` (git operations), `TechDetector` (heuristics), and tools.
- **`cli`** and **`dashboard`** are driving adapters that invoke `MigrationRunner` or consume the REST API.

## 2. Shadow Workspace Isolation (Zero Risk Guarantee)
- **NEVER** modify user code directly in the target path during a migration run.
- All file mutations, compiles (`npm install`, `npm run build`), and edits must take place strictly inside `.metamorph/shadow/<runId>`.
- Any custom agent tools must assert sandbox bounds (`assertSandbox(filePath, sandboxDir)`).
- Applying changes to the target project is performed exclusively by `MigrationIntegrator.applyMigration()`, which requires an existing Git repository and creates a dedicated branch (`metamorph/<runId>`).

## 3. Concurrency and Rate Limits
- The agent loop uses queues (`ConcurrencyQueue(3)`) for Worker and Reviewer agents to prevent exceeding LLM rate limits.
- Never instantiate unbounded parallel LLM agent instances.

## 4. SQLite Persistence
- Persistence relies on Node's built-in `node:sqlite` (`DatabaseSync`). Do not introduce external binary drivers like `better-sqlite3`.
- Any new column added to tables in `SQLiteStateStore` must include backward-compatible `ALTER TABLE` auto-migration queries.
