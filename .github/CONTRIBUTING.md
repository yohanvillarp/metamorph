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

3.  **Open a Pull Request (PR)**:
    Push your branch and open a PR on GitHub targeting **the `develop` branch** (NOT `main`).
    ```bash
    git push origin feature/your-feature-name
    ```

4.  **Review and CI**:
    Our GitHub Actions will run validations, linters, and tests automatically. Once approved and passing, it will be merged into `develop`.

5.  **Release to Production (`main`)**:
    Periodically, the core team will create a Pull Request from `develop` to `main` to release a new version.

## Local Environment

To start developing:
1. `npm install`
2. `npx turbo run build`
