*Leer esto en otros idiomas: [Español](CONTRIBUTING.es.md)*

# Contributing Guidelines for Metamorph

Thank you for your interest in contributing to Metamorph! To maintain code quality and organization, we follow a strict workflow.

## Branching Strategy (Git Flow)

This repository uses the standard Git Flow model:

*   **`main`**: This is the production branch. It contains only stable and tested code. **NEVER commit directly to this branch.**
*   **`develop`**: This is the integration branch. All active development (new features, bug fixes) converges here before going to production.

### Workflow (Step by Step)

1.  **Create a branch from `develop`**:
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feature/your-feature-name
    # Or for fixes: git checkout -b fix/your-fix-name
    ```

2.  **Make your changes and write Conventional Commits**:
    All commits must follow the convention. Running `git commit` will open your editor with our template (check `.gitmessage`).
    Example: `feat(cli): add new parallel processing flag`

3.  **Generate a Changeset (Versioning & Changelogs)**:
    If your PR modifies package code (`packages/@nikelyh/*` or `apps/dashboard/*`), create a changeset:
    ```bash
    npm run changeset
    ```
    Follow the interactive prompts to pick the affected package(s) and bump type (`patch` for fixes, `minor` for new features).
    - **Internal changes / Refactoring**: If your PR contains internal code cleanup that should not trigger an npm release, run `npx changeset --empty` or add the `skip-changeset` label to your PR.
    - Changes that only touch documentation or tests do not require a changeset.

4.  **Open a Pull Request (PR)**:
    Push your branch and open a PR on GitHub targeting **the `develop` branch** (NOT `main`).
    ```bash
    git push origin feature/your-feature-name
    ```
    Our automated workflows will assign relevant architecture labels (`area: catalogs`, `area: domain`, etc.), PR size labels (`size/S`, `size/M`, `size/L`), and our Changeset bot will verify your changeset presence with an instant preview.
    Choose the appropriate Pull Request template from `.github/PULL_REQUEST_TEMPLATE/` (or use the default):
    - `feature.md`: New features and capabilities
    - `bugfix.md`: Bug fixes with RCA and regression tests
    - `migration_target.md`: Adding/updating framework migration pairs
    - `swarm_agent.md`: Mozaik v4 agents, event dynamics, and lifecycle
    - `dashboard_ui.md`: Web dashboard UI, FSD, and zero-emoji compliance
    - `architecture.md`: Architectural refactoring, boundaries, and schema migrations
    - `perf_optimization.md`: Performance bottlenecks, benchmarks, and profiling

5.  **Review and CI**:
    Our GitHub Actions will run validations, linters, and tests automatically. Once approved and passing, it will be merged into `develop`.

6.  **Release to Production (`main`)**:
    Periodically, the core team will create a Pull Request from `develop` to `main` to release a new version.

## Local Environment

To start developing:
1. `npm install`
2. `npx turbo run build`

## Coding & Architectural Standards

All contributions must adhere to our engineering principles:
- **Hexagonal Layer Purity**: `@nikelyh/domain` must have **zero I/O dependencies** (no filesystem, SQLite, or Express).
- **Single Responsibility (SRP)**: Keep functions and classes focused. Handlers should be concise (< 50 lines).
- **Strict Typing**: No `any`. Use strict interfaces, union discriminators, and TypeScript `satisfies`.
- **Zero Magic Strings**: Always use typed enums and constants (`SemanticEventName`, `PackageManagerType`).
- **Dashboard UI Standards**: Adhere to Feature-Sliced Design (FSD) and use vector icons exclusively (`lucide-react`, **strictly zero emojis**).

