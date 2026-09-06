# @nikelyh/metamorph

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
