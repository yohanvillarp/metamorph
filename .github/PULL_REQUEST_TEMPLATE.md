## Title Format
<!-- Ensure your PR title follows Conventional Commits: <type>(<scope>): <short description> -->
<!-- Examples: feat(detector): add monorepo workspace resolver | fix(swarm): prevent worker retry budget overflow -->

## Description
<!-- Provide a clear, concise summary of the change, motivation, and context. What problem does this solve? -->

Fixes # <!-- Issue number, e.g. Fixes #42 -->

---

## Type of Change
<!-- Select all options that apply -->
- [ ] `feat`: New feature (non-breaking change adding functionality)
- [ ] `fix`: Bug fix (non-breaking change fixing an unexpected issue)
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `perf`: Performance improvement (e.g. concurrency, memory, build speed)
- [ ] `test`: Adding missing tests or correcting existing tests
- [ ] `docs`: Documentation updates (README, architecture, guides)
- [ ] `chore`: Tooling, workflow, dependencies, or repository maintenance
- [ ] **BREAKING CHANGE**: Fix or feature causing existing behavior to break

---

## Packages in Scope
<!-- Select the monorepo packages affected by this PR -->
- [ ] `packages/@nikelyh/domain` (Entities, Semantic Events, layered Catalogs, Ports, Zero-I/O contracts)
- [ ] `packages/@nikelyh/application` (Mozaik v4 Agents, MigrationRunner, State Store, Swarm Orchestration)
- [ ] `packages/@nikelyh/infrastructure` (SQLiteStateStore, ShadowWorkspace, ProjectDetector, AST Tools, REST Server)
- [ ] `packages/@nikelyh/cli` (CLI commands, interactive prompts, stdout reporting, flag parsing)
- [ ] `apps/dashboard` (React 18/19, Vite, Tailwind CSS, Feature-Sliced Design UI)
- [ ] `.github` / Tooling (CI/CD workflows, templates, linters, repo configuration)

---

## Architectural Invariants Checklist
<!-- Metamorph enforces strict architectural invariants. Verify each rule below -->
- [ ] **Zero I/O in Domain**: `packages/@nikelyh/domain` contains zero I/O, no filesystem, no SQLite, and no external framework runtime dependencies.
- [ ] **Shadow Workspace Isolation**: All file operations, transforms, and test compilations are strictly confined to `.metamorph/shadow/<runId>`. No modifications to the user's original directory occur prior to `metamorph apply`.
- [ ] **Mozaik v4 Event-Driven Bus**: Agents communicate exclusively via typed semantic events (`SemanticEventName`). No direct blocking synchronous invocation loops (`await runLoop()` / `await sendMessage()`).
- [ ] **Ephemeral Participant Lifecycle**: Dynamic Worker/Reviewer participants always invoke `leave()` upon completion or timeout to prevent memory leaks.
- [ ] **Persistence Compatibility**: Any SQLite schema change includes safe, idempotent `ALTER TABLE` auto-migration queries compatible with existing `history.db` databases.
- [ ] **Polymorphic Package Manager Compatibility**: Commands adhere to detected package manager (`pnpm`, `yarn`, `bun`, `npm`) without hardcoded assumptions.
- [ ] **UI Aesthetics & Zero Emojis**: Dashboard updates adhere to Feature-Sliced Design (FSD), utilize vector icons exclusively (Lucide React), and contain zero emojis.

---

## How Has This Been Tested?
<!-- Describe the automated and manual verification performed -->

- [ ] **Automated Unit & Integration Tests**: (`npm run test`)
- [ ] **Typecheck**: (`npm run typecheck` across all 5 workspace packages)
- [ ] **Production Build**: (`npm run build`)
- [ ] **Package Manager Parity Tested**: (Verified with `npm`, `pnpm`, `yarn`, and/or `bun`)
- [ ] **Manual End-to-End Test**: (CLI run or Dashboard UI session against test playground in `scratch/playgrounds/`)

### Test Reproduction & Evidence:
<!-- Detail test commands, playgrounds used, or paste terminal/browser evidence -->

```bash
npm run typecheck
npm run test
npm run build
```

---

## PR Checklist
- [ ] My code conforms to the project's style guidelines, ESLint, and TypeScript configurations.
- [ ] I have performed a self-review of my code.
- [ ] I have commented complex or non-obvious logic, especially in AST transformations, subsumption DAGs, or agent handlers.
- [ ] Corresponding documentation has been updated if public contracts, CLI flags, or catalog rules changed.
- [ ] My changes introduce no new TypeScript warnings or unhandled Promise rejections.
