# Security Policy

The Metamorph team takes the security of automated software refactoring, child process execution, and isolated sandboxing seriously.

---

## Supported Versions

Only the current major release line receives active security updates and patches:

| Version | Supported |
| :--- | :--- |
| `2.x.x` (current) | :white_check_mark: |
| `< 2.0.0` | :x: |

---

## Core Security Invariants

Metamorph enforces architectural safeguards to protect your development environment:

1. **Shadow Workspace Sandboxing**:
   - All mutations occur strictly within `.metamorph/shadow/<runId>`.
   - All AST tools and filesystem operations enforce path boundary verification via `assertSandbox(filePath, sandboxDir)`. Path traversal or escape attacks outside the designated sandbox are treated as high-severity security defects.
2. **Subprocess Confinement**:
   - Package manager operations (`cleanInstall`, `runBuild`) are executed with explicit working directories (`cwd`) locked to the active shadow workspace to prevent command execution escape into parent directories.
3. **Native Node SQLite Persistence**:
   - Database operations use parameterized queries on Node.js native `DatabaseSync` (`node:sqlite`), mitigating SQL injection risks in local history tracking.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability within Metamorph (including sandbox escape risks or unauthorized file mutations):

1. **Do NOT disclose it publicly** on GitHub Issues or Discussions.
2. Report the vulnerability via **[GitHub Private Vulnerability Reporting](https://github.com/nikelyh/metamorph/security/advisories/new)**.
3. Alternatively, email the maintainers directly at `security@nikelyh.dev` with:
   - A description of the vulnerability.
   - Exact steps to reproduce (including playground repository or proof-of-concept).
   - The potential impact on user files or host systems.

### Response Timeline
- **Initial Response**: Within 48 hours acknowledging receipt.
- **Triage & Assessment**: Within 5 business days detailing the mitigation plan.
- **Security Release**: Once a fix is verified, a patch will be published with an accompanying advisory.
