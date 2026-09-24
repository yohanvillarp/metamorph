## Architectural Scope & Motivation
<!-- Detail the architectural refactoring, component redesign, or subsystem modernization -->

Fixes # <!-- Issue number, e.g. Fixes #104 -->

---

## Hexagonal Boundaries & Invariants Assessment

| Architectural Boundary | Invariant Requirement | Status & Verification |
| :--- | :--- | :--- |
| **`@nikelyh/domain` (Zero I/O)** | Zero `fs`, `node:sqlite`, `express`, or Mozaik SDK imports. Pure contracts, events, and catalogs. | [ ] Verified Zero-I/O |
| **Shadow Workspace Isolation** | All file mutations, transforms, and test compilations strictly sandboxed inside `.metamorph/shadow/<runId>`. | [ ] Verified Sandboxed |
| **Mozaik v4 Swarm Bus** | Pure event-driven communication via `SemanticEventName`. Zero synchronous blocking loops. | [ ] Verified Event-Driven |
| **Ephemeral Agent Lifecycle** | Dynamic Worker/Reviewer participants invoke `leave()` upon exit or timeout. | [ ] Verified Leak-Free |
| **SQLite Persistence** | Native `node:sqlite` (`DatabaseSync`). Idempotent `ALTER TABLE` auto-migration queries. | [ ] Verified Auto-Migrated |
| **Polymorphic Package Manager** | Abstracted package manager execution (`npm`, `pnpm`, `yarn`, `bun`). Zero hardcoded `npm` calls. | [ ] Verified Polymorphic |
| **Dashboard UI (FSD)** | Feature-Sliced Design dependency flow. Vector Lucide icons exclusively (zero emojis). | [ ] Verified FSD & Icons |

---

## Subsystem Changes

### 1. What was removed or deprecated?
<!-- List any deprecated methods, obsolete layers, or deleted files -->
- 

### 2. What replaces it?
<!-- Detail the new abstractions, ports, or adapters -->
- 

### 3. Database Schema Evolution (if applicable)
<!-- Document any new tables, columns, or indices added to history.db -->
```sql
-- Auto-migration SQL executed via try/catch in SQLiteStateStore.ts:
ALTER TABLE ... ADD COLUMN ...;
```

---

## Performance, Concurrency & Memory Impact
- [ ] Memory footprint benchmarked (no uncollected ephemeral participant leaks in Mozaik).
- [ ] Concurrency bounds preserved (`ConcurrencyQueue(3)` limits respected for LLM calls).
- [ ] Subprocess execution timeout and error handling audited.
- [ ] Monorepo build and test performance verified with Turborepo.

---

## Verification
- [ ] `npm run typecheck` passes across all monorepo packages.
- [ ] `npm run test` passes without regression.
- [ ] `npm run build` succeeds cleanly.

