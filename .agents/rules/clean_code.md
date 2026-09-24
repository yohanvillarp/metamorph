---
name: Clean Code and Modular Architecture Rules
description: Engineering standards for clean code, SOLID principles, functional purity, and strict modularity in Metamorph.
---

# Clean Code & Modular Architecture Standards for Metamorph

Every AI agent and human contributor writing or refactoring code in Metamorph must adhere to these standards. Code violating these rules must be rejected during review.

---

## 1. Hexagonal Layer Purity & Decoupling

| Layer | Pure Responsibilities | Forbidden Patterns |
| :--- | :--- | :--- |
| **`@nikelyh/domain`** | Pure contracts, entities, semantic event types, layered catalogs, deterministic value objects. | **NO I/O**. Never import `node:fs`, `node:sqlite`, `express`, or `@mozaik-ai/core`. Zero external SDK dependencies. |
| **`@nikelyh/application`** | Mozaik v4 agent handlers, orchestration state, coordinator watchdog, and runner. | Never import concrete database drivers (`node:sqlite`) or filesystem operations directly; consume ports or inject adapters. |
| **`@nikelyh/infrastructure`** | Concrete implementations of secondary ports (`SQLiteStateStore`, `ShadowWorkspace`, `ProjectDetector`, `AstTools`, REST API). | Do not leak Express `req`/`res` objects or low-level SQLite handles outside the adapter boundary. |
| **`@nikelyh/cli` & `dashboard`** | Primary (driving) adapters. Presentation, interactive prompts, CLI commands, React components. | Never execute direct database mutations or AST file transformations without passing through application use cases / runner. |

---

## 2. SOLID Principles in Metamorph

### 1. Single Responsibility Principle (SRP)
- **Mozaik Agents**: Each agent reacts only to semantic events in its explicit domain. An agent must never do both code transformation and package dependency management.
- **AST Tools**: Tools transform code via AST; they do not read workspace configurations, determine project frameworks, or manage git.
- **Inspectors & Resolvers**: `WorkspaceResolver` only locates roots and package boundaries; `ManifestInspector` only parses manifests; `StructureInspector` only checks file layouts.

### 2. Open/Closed Principle (OCP)
- **Polymorphic Package Managers**: New package managers (`pnpm`, `yarn`, `bun`, `npm`) are supported via strategy mappings (`resolvePackageManagerCommands`) without mutating the migration runner or integration loop.
- **Layered Catalogs**: Adding a framework migration pair adds rules to `catalogs/frameworks/` and registers in `frontendCatalog.ts` / `backendCatalog.ts`. It never requires hacking existing pairs.

### 3. Liskov Substitution Principle (LSP)
- Secondary ports (e.g. `StateRepository`) must be completely interchangeable in tests using in-memory mock repositories without altering application runner behavior.

### 4. Interface Segregation Principle (ISP)
- Create small, focused interfaces rather than monolithic contracts.
- Prefer discrete types (`PackageManifest`, `ProjectProfile`, `PackageManagerCommands`) over generic giant context bags.

### 5. Dependency Inversion Principle (DIP)
- High-level modules (application runner, swarm coordinator) must depend on abstractions (ports and semantic events), never on low-level infrastructure details.

---

## 3. Function & File Hygiene Rules

1. **Function Size**: Functions should be small, focused, and typically under 35–50 lines of code. Extract helper algorithms and predicate functions.
2. **Command-Query Separation (CQS)**:
   - Query methods (`inspectManifest`, `resolveWorkspace`, `calculatePriorityScore`) must be pure and have **zero observable side-effects** on disk or state.
   - Command methods (`executeCommand`, `persistPlan`, `cleanInstall`) must clearly indicate mutation.
3. **Strict Typings (Zero `any`)**:
   - `any` is strictly prohibited. Use explicit interfaces, unknown with type narrowing (`isError`), or generics.
   - Always leverage TypeScript's `satisfies` operator for catalog definitions and rule arrays to preserve literal types.
4. **Zero Magic Strings**:
   - All event names must come from `SemanticEventName`.
   - All package managers must be typed via `PackageManagerType`.
   - All framework keys must be checked against typed catalog constants.
5. **Defensive Programming & Fail-Safe Defaults**:
   - Never assume files exist; verify paths or handle errors gracefully.
   - All database schema updates must execute inside idempotent `try { db.exec(...) } catch {}` blocks.
6. **Error Context & RCA Clarity**:
   - Never swallow exceptions silently with empty `catch {}` unless explicitly expected (e.g., SQLite `duplicate column` during auto-migration).
   - Log descriptive error contexts using structured logging or `system.log` events.

---

## 4. Concurrency & Resource Safety

1. **Bounded LLM Invocations**:
   - Any code that queries an LLM must pass through `ConcurrencyQueue` with maximum limit `3`.
2. **Ephemeral Participant Memory Management**:
   - Temporary agents (`Worker-<timestamp>`, `Reviewer-<timestamp>`) must execute `await participant.leave()` inside a `finally` block to ensure deterministic garbage collection.
3. **Child Process Boundaries**:
   - Every subprocess call (`execFile`, `spawn`) must specify timeout limits, error callbacks, and strictly run inside the target directory.
