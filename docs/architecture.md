# Metamorph System Architecture

This document describes the internal architecture of Metamorph, including its hexagonal layer decomposition, the agent swarm lifecycle, the event-driven communication model, and the shadow workspace pipeline.

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render natively on GitHub.

---

## 1. High-Level System Overview

The following diagram shows the relationship between the user-facing entry points (CLI and Dashboard), the internal processing pipeline, and the external dependencies.

```mermaid
flowchart TB
    subgraph UserLayer["User Entry Points"]
        CLI["CLI<br/>Commander.js"]
        Dashboard["Dashboard<br/>React 18 + Vite"]
    end

    subgraph Core["Metamorph Core"]
        direction TB
        App["Application Layer<br/>Agents + Use Cases"]
        Domain["Domain Layer<br/>Entities, Events, Ports"]
        Infra["Infrastructure Layer<br/>SQLite, FS, Express, ts-morph"]
    end

    subgraph External["External Services"]
        LLM["LLM Provider<br/>OpenAI / Anthropic"]
        Mozaik["Mozaik v4 Runtime<br/>Event Bus + Agent Lifecycle"]
    end

    subgraph Workspace["File System"]
        UserProject["User Project<br/>Original Source Code"]
        Shadow[".metamorph/shadow<br/>Isolated Build Environment"]
        DB[".metamorph/history.db<br/>SQLite Persistence"]
    end

    CLI --> App
    Dashboard -->|REST API| Infra
    Infra --> DB
    App --> Domain
    App --> Infra
    App --> Mozaik
    App -->|Inference Calls| LLM
    Infra --> Shadow
    Infra -.->|Read-Only at Run| UserProject
    CLI -->|metamorph apply| UserProject
```

---

## 2. Hexagonal Architecture

Metamorph follows a strict hexagonal (ports and adapters) architecture. The domain layer has zero I/O dependencies. Application logic depends only on abstract ports defined in the domain. Infrastructure provides the concrete adapters.

```mermaid
flowchart LR
    subgraph Driving["Driving Adapters (Primary)"]
        CLI_Adapter["CLI<br/>packages/@nikelyh/cli"]
        REST_Adapter["Express REST API<br/>infrastructure/server"]
        Dashboard_Adapter["Dashboard<br/>apps/dashboard"]
    end

    subgraph Application["Application Layer"]
        direction TB
        Runner["MigrationRunner"]
        Agents["Agent Definitions<br/>Mapper, Worker, Reviewer,<br/>PackageManager, Coordinator,<br/>Integration, Reporter"]
        Registry["Migration Registry<br/>Plugins + Validators"]
    end

    subgraph Domain["Domain Layer (Zero I/O)"]
        direction TB
        Entities["Entities<br/>MigrationPlan, MigrationProfile"]
        Events["Semantic Events<br/>SemanticEventName enum"]
        Ports["Ports<br/>StateRepository, MigrationCommand"]
        Catalogs["Migration Catalogs<br/>Rules by Layer + Framework Pair"]
    end

    subgraph Driven["Driven Adapters (Secondary)"]
        direction TB
        SQLite["SQLiteStateStore<br/>node:sqlite DatabaseSync"]
        FS["ShadowWorkspace<br/>File System Operations"]
        Detector["TechDetector<br/>Static Heuristic Analysis"]
        AST["AstTools<br/>ts-morph Transformations"]
        Build["BuildTools<br/>npm install / npm run build"]
    end

    CLI_Adapter --> Application
    REST_Adapter --> Application
    Dashboard_Adapter --> REST_Adapter

    Application --> Domain
    Application --> Driven
    Driven -.->|implements| Ports
```

### Layer Rules

| Layer | Package | Allowed Dependencies |
|---|---|---|
| Domain | `@nikelyh/domain` | None (zero I/O, zero external imports) |
| Application | `@nikelyh/application` | Domain |
| Infrastructure | `@nikelyh/infrastructure` | Domain, Application (port implementations only) |
| CLI | `@nikelyh/cli` | Application, Infrastructure |
| Dashboard | `apps/dashboard` | Infrastructure REST API (HTTP only) |

---

## 3. Agent Swarm Architecture

Metamorph orchestrates six specialized agents through the Mozaik v4 runtime. Agents communicate exclusively via semantic events on the bus; they never invoke each other directly.

```mermaid
flowchart TB
    subgraph SwarmBus["Mozaik Event Bus"]
        direction LR
        Bus(("Semantic<br/>Event Bus"))
    end

    subgraph Agents["Agent Swarm"]
        Mapper["MapperAgent<br/>Discovers files to migrate,<br/>emits FILE_DISCOVERED"]
        PkgMgr["PackageManagerAgent<br/>Edits package.json directly,<br/>emits PHASE_PACKAGES_READY"]
        Worker["WorkerAgent<br/>Migrates individual files,<br/>emits FILE_MIGRATED"]
        Reviewer["ReviewerAgent<br/>Validates migrated code,<br/>emits FILE_REVIEWED or FILE_REJECTED"]
        Coordinator["CoordinatorAgent<br/>Monitors swarm readiness,<br/>emits PHASE_INTEGRATION_STARTED"]
        Integration["IntegrationAgent<br/>Runs npm install + build in shadow,<br/>emits MIGRATION_COMPLETED or requeues"]
        Reporter["ReporterAgent<br/>Generates MIGRATION.md report"]
    end

    Bus --> Mapper
    Bus --> PkgMgr
    Bus --> Worker
    Bus --> Reviewer
    Bus --> Coordinator
    Bus --> Integration
    Bus --> Reporter

    Mapper -->|FILE_DISCOVERED| Bus
    PkgMgr -->|PHASE_PACKAGES_READY| Bus
    Worker -->|FILE_MIGRATED / FILE_FAILED| Bus
    Reviewer -->|FILE_REVIEWED / FILE_REJECTED / FILE_FATAL_MISMATCH| Bus
    Coordinator -->|PHASE_INTEGRATION_STARTED| Bus
    Integration -->|MIGRATION_COMPLETED / FILE_REJECTED| Bus
    Reporter -->|SYSTEM_LOG| Bus
```

### Agent Responsibilities

| Agent | Trigger Event | Output Events | Concurrency |
|---|---|---|---|
| **MapperAgent** | `MIGRATION_STARTED` | `FILE_DISCOVERED` (one per file) | 1 instance |
| **PackageManagerAgent** | `MIGRATION_STARTED` | `PHASE_PACKAGES_READY` | 1 instance |
| **WorkerAgent** | `FILE_DISCOVERED`, `FILE_REJECTED` | `FILE_MIGRATED`, `FILE_FAILED` | Up to 3 concurrent (ConcurrencyQueue) |
| **ReviewerAgent** | `FILE_MIGRATED` | `FILE_REVIEWED`, `FILE_REJECTED`, `FILE_FATAL_MISMATCH` | 1 per file |
| **CoordinatorAgent** | `FILE_REVIEWED`, `FILE_FAILED`, `FILE_FATAL_MISMATCH`, `PHASE_PACKAGES_READY` | `PHASE_INTEGRATION_STARTED` | 1 instance (no LLM calls) |
| **IntegrationAgent** | `PHASE_INTEGRATION_STARTED` | `MIGRATION_COMPLETED`, `FILE_REJECTED` (source: integration) | 1 instance (locked per plan) |
| **ReporterAgent** | `MIGRATION_COMPLETED` | `SYSTEM_LOG` | 1 instance |

---

## 4. Migration Lifecycle

The complete lifecycle of a migration run, from CLI invocation to final application.

```mermaid
stateDiagram-v2
    [*] --> Mapping: metamorph run
    Mapping --> Files: FILE_DISCOVERED (all files emitted)
    Files --> Files: Worker migrates + Reviewer validates
    Files --> Files: FILE_REJECTED triggers Worker repair (max 2 retries)
    Files --> Integration: All tasks settled (completed or failed)

    Integration --> Files: Shadow build fails (requeue broken files)
    Integration --> Completed: Shadow build + verifiers pass
    Integration --> Failed: MAX_INTEGRATION_ROUNDS (4) exhausted

    Completed --> Report: ReporterAgent writes MIGRATION.md
    Report --> [*]: metamorph apply (Git branch created)

    Failed --> [*]: metamorph rollback (shadow discarded)

    note right of Mapping
        MapperAgent scans the project tree.
        PackageManagerAgent edits package.json.
        Both run concurrently.
    end note

    note right of Integration
        IntegrationAgent runs npm install
        and npm run build in the shadow
        workspace. Up to 4 rounds.
    end note
```

### Phase Transitions

| Phase | Description | Next Phase |
|---|---|---|
| `mapping` | File discovery and dependency analysis | `files` |
| `files` | Concurrent file migration and review | `integration` |
| `integration` | Shadow workspace build and verification | `completed`, `failed`, or back to `files` |
| `completed` | Build passed, report generated | Terminal (awaiting `apply`) |
| `failed` | Build budget exhausted or unrecoverable error | Terminal (awaiting `rollback`) |

---

## 5. Event Flow Sequence

Detailed sequence of events during a successful migration with one integration repair round.

```mermaid
sequenceDiagram
    actor User
    participant CLI
    participant Mapper as MapperAgent
    participant PkgMgr as PackageManagerAgent
    participant Worker as WorkerAgent
    participant Reviewer as ReviewerAgent
    participant Coord as CoordinatorAgent
    participant Integ as IntegrationAgent
    participant Reporter as ReporterAgent

    User->>CLI: metamorph run --from react --to next
    CLI->>Mapper: MIGRATION_STARTED
    CLI->>PkgMgr: MIGRATION_STARTED

    par File Discovery
        Mapper->>Worker: FILE_DISCOVERED (file A)
        Mapper->>Worker: FILE_DISCOVERED (file B)
        Mapper->>Worker: FILE_DISCOVERED (file N)
    and Package Setup
        PkgMgr->>Coord: PHASE_PACKAGES_READY
    end

    loop For each file (up to 3 concurrent)
        Worker->>Reviewer: FILE_MIGRATED
        alt Approved
            Reviewer->>Coord: FILE_REVIEWED
        else Rejected (retry budget remaining)
            Reviewer->>Worker: FILE_REJECTED (source: reviewer)
            Worker->>Reviewer: FILE_MIGRATED (retry)
            Reviewer->>Coord: FILE_REVIEWED
        end
    end

    Coord->>Integ: PHASE_INTEGRATION_STARTED

    Note over Integ: npm install + npm run build

    alt Build fails (round < 4)
        Integ->>Worker: FILE_REJECTED (source: integration)
        Note over Worker: Repair loop with fresh retry budget
        Worker->>Reviewer: FILE_MIGRATED
        Reviewer->>Coord: FILE_REVIEWED
        Coord->>Integ: PHASE_INTEGRATION_STARTED
        Note over Integ: Rebuild passes
    end

    Integ->>Reporter: MIGRATION_COMPLETED (outcome: success)
    Reporter->>Reporter: Writes MIGRATION.md in shadow
    Reporter->>User: SYSTEM_LOG (report ready)
```

---

## 6. Shadow Workspace Pipeline

The shadow workspace guarantees zero-risk execution. The user's source code is never modified during a migration run.

```mermaid
flowchart LR
    subgraph UserDir["User Project Directory"]
        Src["src/<br/>Original Source"]
        Pkg["package.json<br/>Original"]
    end

    subgraph ShadowDir[".metamorph/shadow/RUN_ID"]
        SSrc["src/<br/>Migrated Source"]
        SPkg["package.json<br/>Updated Dependencies"]
        NM["node_modules/<br/>Installed in Shadow"]
        Build["dist/ or .next/<br/>Shadow Build Output"]
    end

    subgraph ApplyPhase["metamorph apply"]
        GitBranch["Git Branch<br/>metamorph/RUN_ID"]
    end

    Src -->|Copy at start| SSrc
    Pkg -->|Copy at start| SPkg

    SSrc -->|Worker writes here| SSrc
    SPkg -->|PackageManager edits| SPkg
    SPkg -->|npm install| NM
    SSrc -->|npm run build| Build

    SSrc -->|Apply copies to branch| GitBranch
    SPkg -->|Apply copies to branch| GitBranch
```

### Safety Invariants

1. **Read-only access to user project during `run`** -- Agents read the original source for context but write exclusively to the shadow directory.
2. **No global side effects** -- `npm install` and `npm run build` execute only inside `.metamorph/shadow/<runId>`. The `PackageManagerAgent` edits the shadow `package.json` directly via JSON manipulation; it never runs `npm install` in the user directory.
3. **Atomic application** -- `metamorph apply` copies the shadow result into a dedicated Git branch (`metamorph/<runId>`). The user's working tree is not modified until they merge the branch.
4. **Clean rollback** -- `metamorph rollback` deletes the shadow directory and its database records. No trace remains.

---

## 7. Data Persistence Model

```mermaid
erDiagram
    PLANS {
        TEXT id PK
        TEXT run_id UK
        TEXT source
        TEXT target
        TEXT target_path
        TEXT phase
        TEXT outcome
        INT integration_rounds
        TEXT profile_json
        TEXT created_at
    }

    TASKS {
        TEXT plan_id FK
        TEXT file_path
        TEXT status
        TEXT error
        TEXT dependencies_json
    }

    EVENTS {
        INT id PK
        TEXT event_name
        TEXT payload_json
        TEXT timestamp
    }

    PLANS ||--o{ TASKS : "has"
    PLANS ||--o{ EVENTS : "produces"
```

### Task Status Machine

```mermaid
stateDiagram-v2
    [*] --> pending: FILE_DISCOVERED
    pending --> in_progress: Worker picks up task
    in_progress --> in_progress: FILE_MIGRATED (awaiting review)
    in_progress --> completed: FILE_REVIEWED (approved)
    in_progress --> pending: FILE_REJECTED (retry)
    in_progress --> failed: Worker timeout or error
    failed --> pending: IntegrationAgent requeues
    failed --> completed: Build passes (sweep on completion)
    completed --> [*]
    failed --> [*]: MAX_INTEGRATION_ROUNDS exhausted
```

---

## 8. Concurrency and Rate Limiting

| Mechanism | Location | Limit | Purpose |
|---|---|---|---|
| `ConcurrencyQueue` | WorkerAgent | 3 concurrent tasks | Prevent LLM API rate-limit exhaustion |
| `integrationLocks` | IntegrationAgent | 1 per plan | Prevent duplicate build rounds |
| `retryCounts` | WorkerAgent | 2 retries per file | Prevent infinite reject-repair loops |
| `integrationRounds` | IntegrationAgent | 4 rounds per plan | Cap total shadow build attempts |
| Watchdog timer | CoordinatorAgent | 30 min absolute | Terminate stalled migrations |
| Worker timeout | WorkerAgent | 120s per inference | Prevent single-file deadlocks |
| Repair timeout | IntegrationAgent | 120s per repair loop | Prevent integration repair hangs |

---

## 9. Directory Structure Reference

```text
metamorph/
    apps/
        dashboard/                  React 18 + Vite (Feature-Sliced Design)
            src/
                app/                Global setup, providers, router
                pages/              Route-level page components
                widgets/            Overview, SwarmView, Queue, EventLog
                entities/           UI-specific domain types
                shared/             UI kit, API client, hooks
    packages/
        @nikelyh/
            domain/                 Zero-I/O core
                src/
                    entities/       MigrationPlan, MigrationProfile, catalogs/
                    events/         SemanticEventName enum + typed payloads
                    ports/          StateRepository (secondary port)
                    driving/        MigrationCommand (primary port)
            application/            Agents and orchestration logic
                src/
                    agents/         Mapper, Worker, Reviewer, PackageManager,
                                    Coordinator, Integration, Reporter
                    migration/      Plugins, validators, registry
                    utils/          FileTreeBuilder, NeighborContext, NextMigrationHints
            infrastructure/         Concrete adapters
                src/
                    db/             SQLiteStateStore (node:sqlite)
                    workspace/      ShadowWorkspace, MigrationIntegrator
                    detector/       TechDetector (static heuristics)
                    tools/          AstTools (ts-morph), BuildTools, LinterTools
                    server/         Express REST API for Dashboard
            cli/                    Commander-based CLI entry point
    docs/
        architecture.md             This document
        mozaik/                     Local copy of Mozaik v4 documentation
```
