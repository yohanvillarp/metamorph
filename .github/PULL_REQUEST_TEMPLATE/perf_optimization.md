## Performance Optimization Summary
<!-- Detail the bottleneck addressed, the profiling evidence, and the measured gains -->

Fixes # <!-- Issue number, e.g. Fixes #135 -->

### Subsystems Targeted
- [ ] Swarm Orchestration / Mozaik v4 Event Bus
- [ ] Concurrency Queue & LLM Rate Limiting
- [ ] AST Parsing & Transformation (`ts-morph`)
- [ ] Project Intelligence Engine / File System Scanning
- [ ] Shadow Workspace Build / Subprocess Execution
- [ ] SQLite State Store Queries & Indexing
- [ ] Dashboard Real-time Event Streaming & Rendering

---

## Profiling & Benchmark Metrics
<!-- Provide measurable Before vs After performance data -->

| Metric | Before Optimization | After Optimization | Delta / Improvement |
| :--- | :--- | :--- | :--- |
| **Execution Time** | | | |
| **Peak Memory Footprint (RSS)** | | | |
| **AST Parse / Transform Time** | | | |
| **Database Query Latency** | | | |
| **Event Bus Throughput** | | | |

---

## Technical Strategy
<!-- Explain how the performance improvement was achieved -->

- **Root Bottleneck**: 
- **Optimization Strategy**: <!-- e.g., AST caching, parallelized heuristics, indexed SQLite lookups, pruned tree traversal -->
- **Trade-offs / Memory vs CPU Balance**: 

---

## Invariants & Stability Checklist
- [ ] **Zero Functional Regression**: All existing migration and parsing behavior remains 100% identical.
- [ ] **Memory Leak Free**: No uncollected event listeners, open database statement handles, or lingering ephemeral participants.
- [ ] **Concurrency Limits Preserved**: Swarm still strictly respects concurrency boundaries (`ConcurrencyQueue(3)`).
- [ ] **Deterministic Results**: Optimization does not introduce race conditions or non-deterministic file output.

---

## Verification & Benchmarks
<!-- Commands used to verify the performance gain and ensure no regressions -->

- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run test` passes without regression.
- [ ] `npm run build` succeeds cleanly.

```bash
# Benchmark reproduction commands:
npm run test
```
