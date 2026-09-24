## Swarm & Agent Scope
<!-- Specify the Mozaik v4 agents or swarm mechanisms modified or introduced -->

Fixes # <!-- Issue number, e.g. Fixes #77 -->

### Agents Affected
- [ ] `MapperAgent` (File tree analysis, priority scoring, dependency graph)
- [ ] `WorkerAgent` (Ephemeral code transformation, LLM prompt generation, AST neighbor context)
- [ ] `ReviewerAgent` (Ephemeral linting, AST verification, retry budget enforcement)
- [ ] `PackageManagerAgent` (In-memory/JSON manifest delta application without subprocess contamination)
- [ ] `CoordinatorAgent` (Swarm state blackboard, watchdog timeouts, shadow build trigger)
- [ ] `IntegrationAgent` (Shadow build orchestration, clean install, build failure diagnostics)
- [ ] `ReporterAgent` (`MIGRATION.md` generation, dynamic CLI instructions)
- [ ] `SwarmRunner` / `MetamorphState` (Runtime lifecycle, event bus wiring)

---

## Mozaik v4 Event Dynamics & Blackboard Contract
<!-- Detail the semantic event flow and participant interactions -->

- **Semantic Events Emitted**:
  - `SemanticEventName`:
  - Payload definition:
- **Semantic Events Consumed**:
  - `SemanticEventName`:
  - `SituationSpecification` filter / pattern:
- **Blackboard State Mutations**:
  - Keys read / updated in `MetamorphState`:

---

## Agent Lifecycle & Concurrency Invariants
<!-- Verify critical Mozaik v4 concurrency and memory rules -->

- [ ] **Ephemeral Participant Cleanup**: Worker and Reviewer participants execute `await participant.leave()` in `finally` blocks upon completion or failure.
- [ ] **Fire-and-Forget Communication**: No blocking synchronous loops (`await runLoop()` or `await sendMessage()`). Communication occurs purely via event bus publication.
- [ ] **LLM Concurrency Cap**: All LLM queries are queued through `ConcurrencyQueue` with a maximum concurrency limit (default: 3).
- [ ] **Retry Budget Guard**: Normal reviewer rejections do not exceed `MAX_RETRIES = 2`. Integration-originating rejection correctly resets the budget.
- [ ] **Watchdog Synchronization**: The coordinator watchdog does not trigger prematurely while active files remain in `pending` or `in_progress`.

---

## Prompt Engineering & Token Efficiency (if applicable)
- **Prompt Modifications**: <!-- Describe changes to system or user prompt templates -->
- **Context Optimization**: <!-- How is context managed (e.g. NeighborContext, diff size pruning)? -->
- **Deterministic Safeguards**: <!-- Post-processing regex or AST validations preventing hallucinated syntax -->

---

## Automated Verification & Swarm Simulation
<!-- Provide evidence of swarm execution against a mock or playground project -->

- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run test` passes (including agent unit tests with mocked Mozaik runtime).
- [ ] Swarm execution simulated against `scratch/playgrounds/` without unhandled rejections or deadlocks.

```bash
# Verification commands:
npm run typecheck
npm run test
```
