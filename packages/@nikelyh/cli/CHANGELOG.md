# @nikelyh/metamorph

## 2.3.2

### Patch Changes

- b899162: feat(lab): add Fastify, Hono, NestJS, Vue, Svelte, and Angular archetypes to R&D workbench
- 8962540: Wire lab runner service to spawn real metamorph CLI migrations against sandbox archetypes

## 2.3.1

### Patch Changes

- 96e7571: feat(branding): integrate official Metamorph SVG logo across dashboard UI and update website portal redirection

## 2.3.0

### Minor Changes

- 8c7c3c0: feat(cli): add --dry-run flag to preview migration plan without LLM inference
- 44e4f11: feat: add Hono as a supported backend migration target with full CLI and Web Dashboard parity (bidirectional support for Express, Fastify, and NestJS)
- 3f6d785: feat(architecture): establish domain as single source of truth for supported frameworks and migration catalogs with dynamic API
- be6e2e8: feat(dashboard): integrate official documentation, website, and discord community links in header and repository documentation
- 674b684: feat: deterministic mock LLM provider for zero-cost offline development and automated testing (--mock, --model mock)
- 41abc60: feat(dashboard): add shadow workspace diff viewer tab
  
  Adds a new "Diff Viewer" tab to the dashboard that displays file-level diffs between the original project and the shadow workspace. Includes file tree sidebar grouped by status (added/modified/deleted) and unified diff view with syntax highlighting.

### Patch Changes

- 5edbf2b: Add multi-OS (Linux, Windows) and Node LTS matrix, architectural invariant verification, and CLI smoke tests in GitHub Actions CI.
- 7c75e76: ci: add automated changeset reminder bot and PR path labeler workflow with `area: catalogs` categorization
- 7e4ad54: Synchronize dependencies (@mozaik-ai/core 4.1.0, express 5.3.0, tooling) and configure grouped updates in Dependabot.

## 2.2.0

### Minor Changes

- **Backend Target Structural Validation Plugins**: Introduced dedicated shadow workspace verification and file-hint plugins for all backend targets (`target-express`, `target-fastify`, `target-nestjs`). Integration agents now perform deterministic structural assertions, framework repair heuristics, and scaffold verifications on backend codebases matching frontend validation rigor.
- **Cascading Configuration System (`metamorph config`)**: Full CLI command suite (`config get`, `config set`, `config list`, `config path`) backed by a multi-tier cascading resolution hierarchy (`CLI flags` > `Environment variables` > `Local .metamorphrc.json` > `Global ~/.metamorphrc.json` > `Defaults`).
- **Token Accounting & Real-Time Cost Estimation**: Implemented persistent token accounting via `CostAccountingStore` in `.metamorph/history.db`. Accurately tracks prompt, completion, and total tokens per model, with live expenditure visualization in the Dashboard UI.
- **Adaptive Agent Swarm & Dynamic Registry**: Introduced `AgentRegistry` supporting `--disable-agents <list>` execution flags and config. Provides zero-token bypass modes, automatic fallbacks for optional agents, offline server detection, and graceful recovery of zombie/stale migration runs.
- **Project Intelligence Engine (PIE) Parity**: Enhanced detection signals and heuristic confidence scoring for backend runtimes (Express, Fastify, NestJS) and React SPAs, supporting nested entrypoints (`src/app.ts`, `server.ts`, root bootstrap files) and workspace detection.
- **Modular Vertical Architecture Slices**: Refactored CLI commands and Mozaik agent handlers into clean, maintainable vertical slices, reducing CLI entry points to under 35 lines and ensuring strict Hexagonal boundary separation.

## 2.1.2

### Minor & Patch Changes

- **Project Intelligence Engine (PIE)**: Multi-stage heuristic detection with confidence scoring, subsumption DAG, and interactive monorepo workspace selector (`--workspace`, supporting Turborepo, pnpm workspaces, npm/yarn workspaces, and Lerna).
- **Polymorphic Package Manager Engine (PPME)**: Native, lockfile-aware support for `npm`, `pnpm`, `yarn`, and `bun` across dependency configuration, shadow workspace installation/build verification, and dashboard next-steps telemetry.
- **User Experience & Telemetry Polish**: Standardized and refined user-facing agent status messages, queue telemetry, and event descriptions to eliminate internal developer debug jargon.
- **System Architecture Whitepapers**: Published 6 comprehensive technical whitepapers covering PIE, PPME, Mozaik Swarm, Shadow Workspace, Layered Catalogs, and Dashboard FSD in `docs/architecture/`.
- **Interactive Community Governance**: Introduced GitHub Issue Forms, Discussion templates, and formal contribution policies (`SUPPORT.md`, `SECURITY.md`).

## 2.1.1

### Patch Changes

- Fix stale failed tasks counter sweep in IntegrationAgent when shadow build passes.
- Add deterministic regression test harness for Next.js App Router transformations.
- Add Coordinator watchdog timeout handling.
- Expand technical architecture documentation with comprehensive Mermaid diagrams.

## 2.1.0

### Minor Changes

- Coordinator watchdog so Integration always starts after file work settles, layered catalog rules (all → layer → runtime → framework → pair) with Vue/Angular/Svelte scaffolds and verifiers, shadow npm install/build as the real finish line, and a live swarm dashboard.

## 2.0.11

### Patch Changes

- - Added support for .tsx and .jsx files in migration discovery
  - Fixed backup fallback directory path to prevent recursive copying errors

## 2.0.10

### Patch Changes

- aa315e4: - Added GitHub Discussion template and report button to UI
  - Fixed git apply branch bug for playgrounds
  - Synchronized PackageManagerAgent with migration state
  - Removed UI blocking on terminal logs by suppressing NPM standard output

## 2.0.9

### Patch Changes

- Fix: Changed API key warning to a hard block and added `.env` instructions to prevent downstream agent crashes.

## 2.0.8

### Patch Changes

- 211ec10: Feat: Added explicit warnings in CLI when no LLM API key is detected in the environment.

## 2.0.7

### Patch Changes

- f1085e9: Fix: Replaced dynamic CJS require for child_process with ESM dynamic import in PackageManagerAgent to resolve bundler crashes during migrations.

## 2.0.6

### Patch Changes

- b605c2f: Fix: Removed hardcoded localhost:3000 API routes from Dashboard components to properly resolve dynamic CLI server ports.

## 2.0.5

### Patch Changes

- fix Express

## 2.0.4

### Patch Changes

- 008a905: Fix: Resolved UI path resolution error where the static Dashboard was not being served from the correct dist directory.

## 2.0.3

### Patch Changes

- adc6bf4: Fix: Resolved global installation crashes by properly externalizing CLI dependencies (prevented esbuild from bundling massive CJS libraries), correcting sqlite imports, and updating server to use ESM import.meta.dirname instead of __dirname.

## 2.0.2

### Patch Changes

- Update CLI README with centralized documentation links and correct supported migration mappings.

## 2.0.1

### Patch Changes

- Added README documentation

## 2.0.0

### Major Changes

- Initial release of Metamorph AI CLI
