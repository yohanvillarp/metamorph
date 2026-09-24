# AGENTS.md — Metamorph Engineering Guidelines for AI Agents

This document establishes the architectural invariants, engineering standards, verification workflows, and development guidelines that every AI agent must strictly follow when contributing to the **Metamorph** repository.

---

## 1. Project Overview

**Metamorph** (`@nikelyh/metamorph`) is an automated software migration and refactoring system driven by a **concurrent swarm of autonomous AI agents** orchestrated via **Mozaik v4**.

* **Monorepo**: Managed with Turborepo and npm workspaces (`npm@10.8.2`).
* **Architecture**: Strict Hexagonal Architecture (Domain, Application, Infrastructure, CLI, Dashboard).
* **Tech Stack**: TypeScript (ESM), Node.js >= 20, Mozaik v4 (`@mozaik-ai/core`), `node:sqlite`, React 18/19, Vite, Tailwind CSS.

---

## 2. Critical Architectural Invariants (Never Violate)

### Rule 1: Shadow Workspace (Zero-Risk Guarantee)
* **NEVER mutate user source code directly** during an active migration.
* All file mutations, dependency installs, and test compilations (`npm install`, `npm run build`, etc.) must take place strictly inside `.metamorph/shadow/<runId>`.
* All filesystem and AST manipulation tools (`ts-morph`, fs) must enforce boundary confinement via `assertSandbox(filePath, sandboxDir)`.
* Changes are only applied to the user's project when the user explicitly triggers `metamorph apply`, checking out a dedicated Git branch (`metamorph/<runId>`).

### Rule 2: Mozaik v4 Paradigm (Event-Driven & Blackboard)
* **Agents react to events; they are never invoked directly**: Communication happens exclusively by publishing and subscribing to typed semantic events via `SituationSpecification`.
* **Fire-and-Forget**: NEVER use `await runLoop()` or `await sendMessage()`. Mozaik is asynchronous and concurrent.
* **Ephemeral Participant Lifecycle**: Dynamic Worker and Reviewer agents spawn lightweight participants (`Worker-<timestamp>`, `Reviewer-<timestamp>`) and MUST call `await participant.leave()` inside `finally` blocks upon completion or failure to avoid runtime memory leaks.
* **Zero npm subprocesses during package preparation**: `PackageManagerAgent` mutates `package.json` JSON directly on disk without running `npm install` subprocesses that could pollute the host directory or escape to the monorepo root.

### Rule 3: Strict Hexagonal Separation
* `packages/@nikelyh/domain`: **Zero I/O**. Zero external dependencies on Mozaik, Express, fs, or SQLite. Contains exclusively pure entities, contracts (ports), semantic events, and layered catalogs.
* `packages/@nikelyh/application`: Use-case logic and Mozaik agent handlers. Depends on `domain` and receives ports injected from `infrastructure`.
* `packages/@nikelyh/infrastructure`: Implements secondary ports: SQLite storage, filesystem adapters, `ts-morph` tools, and Express REST server.
* `packages/@nikelyh/cli` & `apps/dashboard`: Primary (driving) presentation adapters that consume application use cases.

### Rule 4: Native SQLite Persistence
* Persistence utilizes **`node:sqlite` (`DatabaseSync`)** included natively in Node.js.
* **DO NOT** install or import heavy binary drivers like `better-sqlite3`.
* All table modifications must include safe, idempotent `ALTER TABLE` queries wrapped in try/catch error handling for backwards-compatible auto-migration.

---

## 3. Directory Structure

```text
metamorph/
├── apps/
│   └── dashboard/                  # React 18/19 + Vite Web Dashboard (Feature-Sliced Design)
│       └── src/
│           ├── app/                # Global setup, providers, routers
│           ├── pages/              # Page-level route views
│           ├── widgets/            # Overview, SwarmView, Queue, EventLog, NextStepsViewer
│           ├── entities/           # Domain-specific UI models and cards
│           └── shared/             # UI kit, api-client, Lucide icons, hooks
├── packages/
│   └── @nikelyh/
│       ├── domain/                 # Zero-I/O Core: Entities, Semantic Events, Layered Catalogs
│       │   └── src/
│       │       ├── entities/       # MigrationPlan, MigrationProfile, catalogs/
│       │       ├── events/         # SemanticEvents (typed names and payloads)
│       │       ├── ports/          # StateRepository (secondary port)
│       │       └── driving/        # MigrationCommand (primary port)
│       ├── application/            # Mozaik Agents, Runtime, MetamorphState, MigrationRunner
│       │   └── src/
│       │       ├── agents/         # Mapper, Worker, Reviewer, PackageManager, Coordinator, Integration, Reporter
│       │       ├── migration/      # Plugins, structure verifiers, registry
│       │       └── utils/          # FileTreeBuilder, NeighborContext, NextMigrationHints
│       ├── infrastructure/         # Concrete Adapters
│       │   └── src/
│       │       ├── db/             # SQLiteStateStore (.metamorph/history.db)
│       │       ├── workspace/      # ShadowWorkspace, MigrationIntegrator
│       │       ├── detector/       # Project Intelligence Engine (PIE) & Heuristics
│       │       ├── tools/          # AstTools (ts-morph), BuildTools, LinterTools
│       │       └── server/         # Express REST API (SSE endpoints for Dashboard)
│       └── cli/                    # Executable CLI with Commander and Ora
├── .agents/                        # AI context rules, skills, and knowledge base
└── docs/                           # Architectural whitepapers and engineering standards
```

---

## 4. Verification & Development Commands

Before proposing or finalizing code changes, always run the following verification commands:

### Compile & Typecheck Entire Monorepo
```bash
npm run build
```

### Run Monorepo Typecheck Only
```bash
npm run typecheck
```

### Run Test Suite
```bash
npm run test
```

### Run CLI Directly from Source
```bash
# In packages/@nikelyh/cli:
npm run dev -- run ../../../scratch/playgrounds/react-app --from react --to next
```

### Start Web Dashboard Locally
```bash
# From packages/@nikelyh/cli or monorepo root:
npm run dev -- ui
```

---

## 5. Code Conventions & Style

* **Strict Typing**: Always declare explicit types in TypeScript (`noImplicitAny: true`). The use of `any` is strictly prohibited.
* **Semantic Events**: Always use the `SemanticEventName` enum and typed `SemanticEventPayloads.*` interfaces. Never publish raw string literals.
* **Concurrency Bounds**: All LLM-calling agents must execute through `ConcurrencyQueue` with a strict limit (`limit: 3`).
* **Neighbor Context**: When transforming code, always inspect imported neighbor files (`NeighborContext`) to preserve exact public prop names and export signatures.
* **Dashboard FSD Layering**: Respect Feature-Sliced Design dependency flow (`shared` -> `entities` -> `features` -> `widgets` -> `pages` -> `app`). Cross-imports on the same layer are strictly prohibited.
* **Strict Zero-Emoji Rule**: Never introduce unicode emojis into the Dashboard UI. Use `lucide-react` vector icons exclusively.

---

## 6. Deprecations & Important Warnings

1. **`resolveMigrationCatalog` vs `findMigrationCatalogEntry`**:
   - `findMigrationCatalogEntry` is **deprecated**.
   - Always use `resolveMigrationCatalog(source, target)`, which composes rules by layers (`ALL_MIGRATION_RULES` -> `layers` -> `runtimes` -> `frameworks` -> `pair`).
2. **Terminal CWD on Windows (PowerShell Quirk)**:
   - If running PowerShell commands, always force execution into the project root explicitly (e.g. `cd <directory> && <command>`).
3. **App Router Pages Collision**:
   - The `src/pages` folder in legacy SPAs must not become Next.js Pages Router routes when targeting App Router (`src/app`). It must be reorganized into view components and linked through `src/app/**/page.tsx`.
4. **Worker Retry Budgets**:
   - Maximum 2 retries (`MAX_RETRIES = 2`) for reviewer rejections before emitting `file.failed`.
   - If a rejection originates from `IntegrationAgent` (shadow build failure), the retry counter is reset to allow collective repair.

---

## 7. Pull Request Templates Suite (GitHub PR Templates)

Metamorph provides a suite of structured, professional PR templates in `.github/PULL_REQUEST_TEMPLATE/` and the default `.github/PULL_REQUEST_TEMPLATE.md`. AI agents preparing or proposing PRs must select and complete the appropriate template:

| Template | File | When to Use |
| :--- | :--- | :--- |
| **Default** | `.github/PULL_REQUEST_TEMPLATE.md` | General cross-cutting changes or default fallback. |
| **Feature** | `.github/PULL_REQUEST_TEMPLATE/feature.md` | New system capabilities (PIE, polymorphic PM, CLI features, state). |
| **Bug Fix** | `.github/PULL_REQUEST_TEMPLATE/bugfix.md` | Bug fixes. Requires severity, RCA, and deterministic regression test. |
| **Migration Target** | `.github/PULL_REQUEST_TEMPLATE/migration_target.md` | New framework migration pairs (`from` -> `to`), catalogs, and scaffolds. |
| **Swarm & Agent** | `.github/PULL_REQUEST_TEMPLATE/swarm_agent.md` | Mozaik v4 agent logic, event bus, participant lifecycles (`leave()`), and prompts. |
| **Dashboard UI** | `.github/PULL_REQUEST_TEMPLATE/dashboard_ui.md` | Changes in `apps/dashboard`. Verifies FSD, zero emojis, and dynamic PM rendering. |
| **Architecture** | `.github/PULL_REQUEST_TEMPLATE/architecture.md` | Structural refactors, hexagonal boundaries, and SQLite auto-migrations. |
| **Performance** | `.github/PULL_REQUEST_TEMPLATE/perf_optimization.md` | Performance improvements with Before vs After profiling metrics. |

### Rules for Agents Proposing PRs:
1. **Identify Change Category**: Select the exact template file matching the scope of work.
2. **Enforce Core Invariants**: Verify Zero I/O in Domain, Shadow Workspace isolation, Mozaik v4 bus, SQLite auto-migrations, polymorphic package managers, and zero emojis in UI.
3. **Provide Reproducible Evidence**: Include test commands (`npm run typecheck`, `npm run test`, `npm run build`) and reproduction steps.

---

## 8. Clean Code & Modularity Standards

All code generated, refactored, or proposed by AI agents must strictly follow these engineering standards (see detailed guide in `.agents/rules/clean_code.md`):

1. **Single Responsibility Principle (SRP)**:
   - An agent handles a single event domain.
   - AST tools only perform code transforms; they do not read workspace configs or manage Git.
2. **Functional Purity in `@nikelyh/domain` (Zero I/O)**:
   - Prohibited from importing I/O modules (`fs`, `node:sqlite`, `express`, `mozaik`).
   - Entities, commands, and catalog resolution functions must be pure and deterministic.
3. **Strict Typing (Zero `any`)**:
   - `any` is strictly banned. Use explicit interfaces, `unknown` with type guards (`isError`), or generics.
   - Use `satisfies` when defining arrays or rule catalogs to preserve exact literal types.
4. **Elimination of Magic Strings**:
   - Package managers: Always via `PackageManagerType`.
   - Event bus names: Always via `SemanticEventName`.
   - Migration phases: Always via `MigrationPhase`.
5. **Command-Query Separation (CQS)**:
   - Code inspection functions (`inspectManifest`, `resolveWorkspace`) are pure *queries* with zero mutation.
   - Mutating functions (`executeCommand`, `persistPlan`) must make their side effects explicit.
6. **Ephemeral Participant Disposal**:
   - In Mozaik v4, all dynamic participants (`Worker-*`, `Reviewer-*`) must execute `await participant.leave()` in `finally` blocks to guarantee zero memory leaks.
