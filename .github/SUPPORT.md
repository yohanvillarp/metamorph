# Getting Support for Metamorph

Welcome to the Metamorph community! We want to ensure your experience refactoring and migrating codebases with our autonomous agent swarm is seamless and productive.

---

## Which Channel Should I Use?

| I need to... | Recommended Channel |
| :--- | :--- |
| **Report a failed migration / compiler failure** | Open a [Migration Failure Report](https://github.com/nikelyh/metamorph/issues/new?template=01_migration_failure.yml) |
| **Report a bug in the CLI or Dashboard** | Open a [Bug Report](https://github.com/nikelyh/metamorph/issues/new?template=02_bug_report.yml) |
| **Ask questions about how to migrate a specific framework** | Ask in [GitHub Discussions (Q&A)](https://github.com/nikelyh/metamorph/discussions/categories/q-a) |
| **Propose a new framework target pair** | Submit a [Target Request](https://github.com/nikelyh/metamorph/issues/new?template=03_target_request.yml) |
| **Report a detection or monorepo issue** | Open a [Detection Issue](https://github.com/nikelyh/metamorph/issues/new?template=04_detection_issue.yml) |
| **Report a security vulnerability** | Follow the private reporting instructions in [SECURITY.md](./SECURITY.md) |

---

## Frequently Asked Questions (FAQ)

### 1. Does Metamorph modify my original codebase during a migration?
**No.** Metamorph enforces a strict **Zero-Risk Guarantee**. All file mutations, scaffolding, package manager executions, and compiler runs happen in an isolated shadow directory (`.metamorph/shadow/<runId>`). Your original code is only updated when you explicitly execute `metamorph apply`, which checks out a dedicated Git branch (`metamorph/<runId>`).

### 2. What versions of Node.js are supported?
Metamorph requires **Node.js >= 20.0.0** because it utilizes native `node:sqlite` (`DatabaseSync`) for local session persistence without heavy binary driver dependencies.

### 3. Does Metamorph support pnpm, yarn, or bun?
**Yes.** The Polymorphic Package Manager Engine (PPME) automatically detects your lockfiles (`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json`) and runs the appropriate commands without hardcoding `npm`.

### 4. How can I inspect or rollback an unapplied migration?
To discard a run without touching your project:
```bash
metamorph rollback <runId>
```
To clear past database history:
```bash
metamorph reset
```

---

## Community Resources

- **Documentation & Whitepapers**: Explore our deep-dive architecture docs in [`docs/architecture/`](../docs/architecture/).
- **GitHub Discussions**: Share your migration success stories in [Show & Tell](https://github.com/nikelyh/metamorph/discussions).
