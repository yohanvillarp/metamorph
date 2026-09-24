---
name: Metamorph Migration Catalogs & Layered Rules
description: Guidelines for defining, composing, and extending migration catalog rules and scaffolds.
---

# Metamorph Migration Catalogs Guidelines

## 1. Composable Layer Hierarchy
Rules provided to the LLM workers are composed through 5 distinct levels:
1. **`ALL_MIGRATION_RULES` (`layers/all.ts`)**: Invariants that apply to any migration (preserve public exports, do not invent props, deduplicate imports, check relative paths).
2. **Layer Rules (`layers/frontend.ts` / `layers/backend.ts`)**: Specific to frontend (state, hooks, DOM lifecycle) or backend (HTTP request/reply, middleware, routing).
3. **Runtime Rules (`layers/runtimes.ts`)**: Specific to targeted runtime engines (e.g. Vite SPA, Next App Router, Angular CLI).
4. **Framework Packs (`frameworks/`)**: Contracts, components, routing, styling, and anti-patterns for individual frameworks.
5. **Pair Rules (`backendCatalog.ts` / `frontendCatalog.ts`)**: Pair-specific mappings (e.g. Express `req.params` -> Fastify `request.params`, Next `useRouter` -> React `react-router-dom`).

## 2. Adding a New Framework or Migration Pair
To add a new framework pair (e.g. `express` -> `koa` or `react` -> `solid`):
1. **Define Framework Pack**: Add framework contract in `packages/@nikelyh/domain/src/entities/catalogs/frameworks/` if not present.
2. **Add Pair Entry**: Add entry to `frontendCatalog.ts` or `backendCatalog.ts` including:
   - `source` and `target` names.
   - `architecturalRules`: Key transformation guidelines.
   - `examples`: Before/After snippets.
   - `dependenciesToRemove` / `dependenciesToAdd`: Package changes for `package.json`.
   - `devDependenciesToRemove` / `devDependenciesToAdd`.
   - `scriptsToUpdate` / `scriptsToRemove`.
   - `filesToDelete`: Deprecated config files to delete.
   - `filesToScaffold`: Initial boilerplate files needed to boot the target framework.
3. **Update CLI Supported Map**: Update `SUPPORTED_MIGRATIONS` in `packages/@nikelyh/cli/src/index.ts`.
4. **Update Project Intelligence Engine**: Add detection signatures in `packages/@nikelyh/infrastructure/src/detector/rules/detectionRules.ts` and verify resolution with `resolveMigrationCatalog(source, target)`.

