---
name: Metamorph Swarm & Agent Rules
description: Behavioral rules, event contracts, concurrency, and guidelines for Metamorph Mozaik agents.
---

# Metamorph Swarm & Agent Rules

## 1. Agent Design Principles in Mozaik
- **Agents are reactive, not sequentially invoked**: Agents register `SituationSpecifications` and react to semantic events on the Mozaik bus.
- **Fire-and-Forget**: Never `await runLoop()` or block waiting for an agent's completion. Agents communicate by emitting new semantic events.
- **Dynamic Ephemeral Agents**: Workers and Reviewers spin up lightweight temporary agents (`Worker-<timestamp>`, `Reviewer-<timestamp>`) per file to maintain clean context windows, and call `leave()` upon completion or timeout.

## 2. Agent Responsibilities & Rules
- **Mapper**: Scans the shadow workspace. Must filter out build directories (`node_modules`, `dist`, `build`, `.next`, etc.). Must register files in SQLite before emitting `file.discovered`.
- **PackageManager**: Must **never** execute subprocess `npm install` directly in the project root or shadow workspace during this phase. It directly mutates `package.json` JSON on disk to prevent contaminating the parent workspace.
- **Worker**:
  - Injects neighbor files (`NeighborContext`) and whole-project tree (`FileTreeBuilder`) to deduce real prop names and imports.
  - Limits retries to `MAX_RETRIES = 2`.
  - Rejections originating from `integration` reset the retry budget.
- **Reviewer**:
  - Always executes static syntax verification with `ts-morph` before delegating to the LLM.
  - Evaluates imports/props against imported neighbors.
  - Emits `file.fatal_mismatch` only for irreversible paradigm violations.
- **Coordinator**:
  - Non-LLM participant.
  - Runs a watchdog timer every 8 seconds (up to 30 minutes) to ensure that if all file tasks are settled and packages are ready, `phase.integration_started` is emitted.
- **Integration**:
  - Runs `npm install` and `npm run build` in the shadow workspace.
  - Can run up to 4 integration rounds.
  - Reopens broken files as `file.rejected` with `source: 'integration'` if build or catalog verifiers fail.
- **Reporter**:
  - Generates `MIGRATION.md` in the shadow workspace upon `migration.completed`.

## 3. Event Typing
- Always use `SemanticEventName` enum values and payloads typed with `SemanticEventPayloads.*`.
- Avoid string literals for event names.
