## Migration Pair Definition
<!-- Define the framework migration pair implemented or improved in this PR -->

- **Source Framework**: 
- **Target Framework**: 
- **Layer**: `frontend` | `backend`
- **Target Runtime**: `vite-spa` | `next-app` | `angular-cli` | `node-service` | Other:
- **Supported Package Managers**: `npm` | `pnpm` | `yarn` | `bun` (All / Subsets)

Fixes # <!-- Issue number, e.g. Fixes #56 -->

---

## 1. Project Intelligence Detection
<!-- Every target must be detectable by the Project Intelligence Engine (PIE) -->

- [ ] **Detection Rules**: Added or updated in `packages/@nikelyh/infrastructure/src/detector/rules/detectionRules.ts`.
- [ ] **Characteristic Signatures**: Specified unique `configFiles`, `packageKeys`, dev tooling, or extensions.
- [ ] **Subsumption Priority**: Positioned correctly in `SubsumptionEngine.ts` DAG to avoid meta-framework shadowing (e.g. Vite SPA vs Next.js vs Remix).

---

## 2. Layered Catalog Implementation
<!-- Metamorph uses layered catalogs: ALL -> layer -> runtime -> framework -> pair -->

- [ ] **Catalog Entry**: Added or updated in `packages/@nikelyh/domain/src/entities/catalogs/` (Frontend or Backend).
- [ ] **Catalog Resolver**: Verified that `resolveMigrationCatalog(source, target)` composes all rule sections without errors.
- [ ] **Scaffolds Defined**: Target bootstrapping files added to `scaffolds.ts` (e.g. config files, entrypoints, tsconfig).
- [ ] **Dependency Delta**:
  - `dependenciesToAdd`:
  - `dependenciesToRemove`:
  - `devDependenciesToAdd`:
  - `devDependenciesToRemove`:
- [ ] **Scripts Delta**: Added/modified scripts in `package.json` (e.g. `dev`, `build`, `start`).
- [ ] **Files to Delete**: Deprecated source-specific files specified in `filesToDelete`.

---

## 3. Verifiers & AST Neighbor Context
- [ ] **Structure Verifiers**: Added structural checks to validate generated directory structure before running compile (e.g. preventing Pages/App router collisions or missing layouts).
- [ ] **AST / Neighbor Context**: Worker prompt rules preserve public exports and callback props for neighbors.

---

## 4. End-to-End Playground Verification
<!-- Verify the pair against a real fixture project in scratch/playgrounds/ -->

- [ ] **Fixture Tested**: `scratch/playgrounds/<fixture-name>`
- [ ] **Shadow Workspace Execution**:
  - `cleanInstall`: Executed successfully inside shadow workspace with detected package manager.
  - `runBuild`: Shadow compile passed cleanly without unresolved imports or syntax errors.
- [ ] **MIGRATION.md Generated**: ReporterAgent produced a clean briefing file with dynamic package manager commands.
- [ ] **Apply Verified**: Changes apply cleanly onto a dedicated git branch (`metamorph/<runId>`).

```bash
# Command used to test the pair:
npx tsx packages/@nikelyh/cli/src/index.ts run scratch/playgrounds/<fixture> --from <source> --to <target>
```

