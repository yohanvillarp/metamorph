---
"@nikelyh/metamorph": patch
"@nikelyh/infrastructure": patch
"@nikelyh/application": patch
---

Fix: Resolved global installation crashes by properly externalizing CLI dependencies (prevented esbuild from bundling massive CJS libraries), correcting sqlite imports, and updating server to use ESM import.meta.dirname instead of __dirname.
