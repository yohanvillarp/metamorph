---
name: add-migration-target
description: Step-by-step workflow for implementing support for a new framework migration pair in Metamorph.
---

# Adding a Migration Target in Metamorph

Follow this systematic checklist when adding a new source/target migration pair:

## Step 1: Framework Heuristic Detection
1. Open `packages/@nikelyh/infrastructure/src/detector/rules/detectionRules.ts`.
2. Add the framework rule to `DETECTION_RULES` specifying `packageKeys`, `configFiles`, and dev tooling signatures.

## Step 2: Catalog Definitions & Scaffolds
1. Determine if the framework belongs to `frontend` or `backend`.
2. If the framework is new, create its pack in `packages/@nikelyh/domain/src/entities/catalogs/frameworks/<name>.ts` exporting contracts, components, routing, and anti-patterns.
3. Add the pair entry to:
   - `packages/@nikelyh/domain/src/entities/catalogs/frontendCatalog.ts` (for UI) OR
   - `packages/@nikelyh/domain/src/entities/catalogs/backendCatalog.ts` (for servers/APIs).
4. Specify:
   - `architecturalRules`
   - `examples` (Before / After)
   - `dependenciesToAdd`, `dependenciesToRemove`
   - `devDependenciesToAdd`, `devDependenciesToRemove`
   - `scriptsToUpdate`, `scriptsToRemove`
   - `filesToDelete`
   - `filesToScaffold` (in `packages/@nikelyh/domain/src/entities/catalogs/scaffolds.ts` if reusable).

## Step 3: CLI & API Registration
1. In `packages/@nikelyh/cli/src/index.ts`, update `SUPPORTED_MIGRATIONS` mapping.
2. Ensure the dashboard `packages/@nikelyh/infrastructure/src/server/api.ts` can resolve the new pair via `resolveMigrationCatalog(from, to)`.

## Step 4: Verification
1. Build the monorepo: `npm run build`.
2. Test against a sample playground in `scratch/playgrounds/`.

