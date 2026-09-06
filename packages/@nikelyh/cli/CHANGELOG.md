# @nikelyh/metamorph

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
