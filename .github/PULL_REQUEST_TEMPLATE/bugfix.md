## Bug Description & Impact
<!-- Clearly describe the bug encountered, under what conditions it reproduces, and user impact -->

Fixes # <!-- Issue number, e.g. Fixes #89 -->

**Severity**: `Critical` (crash/data loss) | `High` (blocked migration) | `Medium` (unexpected behavior) | `Low` (cosmetic/logging)

---

## Environment & Reproduction Scenario
<!-- Provide the exact conditions under which the bug reproduced -->

- **Operating System**: Windows / Linux / macOS
- **Node.js Version**: (>= 20.0.0)
- **Package Manager**: `npm` | `pnpm` | `yarn` | `bun`
- **Framework Pair / Migration Path**: (e.g. `react` -> `next` or N/A)

---

## Root Cause Analysis (RCA)
<!-- Explain why the bug occurred at the architectural or code level -->

- **Component / File**: `packages/...` or `apps/...`
- **Fault Mechanism**: <!-- What sequence of events caused the failure? -->
- **Why was it not caught earlier?**: <!-- Missing test scenario, race condition, platform difference -->

---

## The Solution
<!-- Explain the fix and how it prevents regression without creating unintended side effects -->

- 
- 

---

## Concurrency, Timeouts & Agent Lifecycle Impact
<!-- If the bug affected swarm execution, verify these constraints -->
- [ ] **Ephemeral Participants**: Ephemeral worker/reviewer agents execute `leave()` upon completion or timeout without leaking memory.
- [ ] **Retry Budget Preservation**: Normal reviewer rejections stay within `MAX_RETRIES = 2`. Integration-originating rejections reset the retry counter.
- [ ] **Watchdog Synchronization**: Coordinator watchdog timer correctly detects terminal file states before initiating shadow build.
- [ ] **Process Boundaries**: Child process execution (CLI, builds, package managers) does not hang or escape sandbox constraints.
- [ ] **Not Applicable**: The bug does not impact the agent lifecycle or event loop.

---

## Regression Test & Verification
<!-- Every bugfix MUST include a deterministic regression test that reproduces the bug before the fix and passes after -->

- [ ] **Regression Test Added**:
  - File: `packages/.../*.test.ts`
  - Test description:
- [ ] `npm run typecheck` passes with zero errors across all packages.
- [ ] `npm run test` passes locally.
- [ ] `npm run build` succeeds without build artifacts regression.

```bash
# Command to run the specific test:
npx tsx --test path/to/test.ts
```

