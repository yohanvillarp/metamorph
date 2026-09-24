## Feature Summary
<!-- Describe the new capability, why it was needed, and how it solves user problems -->

Fixes # <!-- Issue number, e.g. Fixes #123 -->

---

## Architectural Design & Hexagonal Boundaries
<!-- Detail how the feature is distributed across the monorepo layers -->

- **Domain (`packages/@nikelyh/domain`)**:
  - New entities / value objects / contracts:
  - New semantic events or payload extensions:
  - Layered catalogs or zero-I/O rules added:
- **Infrastructure (`packages/@nikelyh/infrastructure`)**:
  - Ports implemented or new tool adapters:
  - SQLite persistence updates (including idempotent `ALTER TABLE` auto-migration):
  - Detector rules, workspace resolvers, or AST manipulators:
- **Application (`packages/@nikelyh/application`)**:
  - Mozaik v4 agents created or updated:
  - Watchdog, coordination, or concurrency queue logic:
- **Driving Adapters (CLI / Dashboard)**:
  - CLI flags, interactive prompts, or stdout reporting:
  - Dashboard UI components, widgets, or state hooks:

---

## Monorepo & Package Manager Compatibility
<!-- Verify how this feature handles various ecosystem environments -->
- [ ] **Polymorphic Package Manager**: Works seamlessly across `npm`, `pnpm`, `yarn`, and `bun`.
- [ ] **Monorepo / Nested Workspaces**: Correctly handles package-level isolation (e.g. `pnpm-workspace.yaml`, Turborepo, lerna, npm workspaces).

---

## LLM & Resource Footprint
- [ ] **Deterministic (Zero LLM Tokens)**: Pure static analysis, heuristics, or toolchain logic that consumes 0 AI tokens.
- [ ] **LLM-Powered**: If agents make LLM calls, concurrency is strictly throttled via `ConcurrencyQueue(3)` to prevent rate limit saturation.
- [ ] **Prompt Integrity**: Added prompt templates enforce strict, concise responses without hallmarked files or missing exports.

---

## Invariants Verification
- [ ] **Zero I/O in Domain**: No `fs`, `node:sqlite`, `express`, or Mozaik SDK imports in `@nikelyh/domain`.
- [ ] **Shadow Workspace Confined**: No modifications touch the user's source code before explicit `metamorph apply`.
- [ ] **Participant Lifecycle**: Dynamic Mozaik participants execute `leave()` upon exit or timeout.
- [ ] **Zero Emojis in UI**: If Dashboard was touched, all visual states use Lucide vector icons exclusively.
- [ ] **Backward Compatibility**: Existing `history.db` databases continue to function without migration errors.

---

## Automated Verification & Reproduction
<!-- Paste terminal reproduction output or describe test steps -->

- [ ] `npm run typecheck` passes cleanly across all 5 packages.
- [ ] `npm run test` passes with new deterministic test cases covering this feature.
- [ ] `npm run build` succeeds for monorepo bundles and UI dist assets.

```bash
# Reproduction commands:
npm run typecheck
npm run test
npm run build
```

