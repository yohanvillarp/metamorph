# 🦋 Metamorph CLI

**The AI Multi-Agent Migration CLI**

[![npm version](https://img.shields.io/npm/v/@nikelyh/metamorph.svg?style=flat-square&color=blue&logo=npm)](https://www.npmjs.com/package/@nikelyh/metamorph)
[![Powered by Mozaik](https://img.shields.io/badge/Powered%20by-Mozaik-6366f1.svg?style=flat-square&logo=github)](https://github.com/jigjoy-ai/mozaik)

<p>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white" alt="Turborepo" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

Metamorph is a CLI tool powered by [Mozaik](https://github.com/jigjoy-ai/mozaik) that automates complex architectural shifts and framework migrations in your codebase. Instead of doing it manually, Metamorph spawns a swarm of specialized AI agents that safely refactor your code in an isolated "Shadow Workspace".

**[Read the Full Documentation](https://metamorph.nikelyh.tech/docs)** | **[System Architecture](https://github.com/yohanvillarp/metamorph/blob/main/docs/architecture.md)**

## Features

- **Project Intelligence Engine (PIE)** -- Autonomously detects project architecture, frameworks, and monorepo workspace topologies (Turborepo, pnpm workspaces, npm/yarn workspaces, Lerna).
- **Polymorphic Package Manager (PPME)** -- Automatically detects and adapts to your chosen package manager (`npm`, `pnpm`, `yarn`, `bun`) without host process leakage.
- **Multi-Agent Concurrency** -- Utilizes Mapper, Worker, Reviewer, Integration, and Coordinator agents to migrate code in parallel.
- **Zero Risk (Shadow Workspace)** -- All migrations happen in an isolated `.metamorph/shadow` workspace. Your original code is completely untouched until you explicitly approve and apply the changes.
- **Shadow Build Verification** -- Every migration is validated with your package manager (`npm`, `pnpm`, `yarn`, `bun`) and verification build inside the shadow workspace before completion.
- **Visual Dashboard** -- Watch your agents work in real-time through the built-in local dashboard UI.
- **Extensive Framework Support** -- Easily migrate between popular frontend and backend frameworks.

## Installation

Install Metamorph globally via NPM:

```bash
npm install -g @nikelyh/metamorph
```

### Prerequisites

- Node.js >= 20
- An LLM provider API key (OpenAI, Anthropic, or compatible). Set it as an environment variable:
  ```bash
  export OPENAI_API_KEY=sk-...
  ```

## Typical Workflow

### 1. Start a Migration

Navigate to the root of the project you want to migrate and run:

```bash
metamorph run
```

Metamorph automatically detects your current stack (e.g., Express, React) and prompts you to select the target framework. You can bypass the interactive prompt by passing the source explicitly:

```bash
metamorph run --from express
```

### 2. Monitor the Agents (Dashboard UI)

Once a migration is running, the AI swarm begins working in the background. To see their real-time progress, open a new terminal in the same directory and run:

```bash
metamorph ui
```

This starts the internal dashboard server and opens a monitoring interface in your default browser. You can specify a port with `--port 8080`.

### 3. Review and Apply

After the AI finishes the migration in the isolated Shadow Workspace, you will receive a `runId`. Apply the completed migration to your actual repository (which automatically creates a new Git branch for safety):

```bash
metamorph apply <runId> .
```

### 4. Managing Migrations

Discard a run without applying it:

```bash
metamorph rollback <runId>
```

View migration history:

```bash
metamorph list
```

Clear the local database and reset all events:

```bash
metamorph reset
```

### Utility Commands

Test the technology detection on your repository without starting a migration:

```bash
metamorph detect .
```

View all available commands and options:

```bash
metamorph --help
```

## Supported Migrations

The list of supported architectural shifts is updated frequently as new migration catalogs are added.

See the complete, up-to-date list of all supported frontend and backend framework migrations in the official documentation:

**[View Supported Migrations](https://metamorph.nikelyh.tech/docs/migrations)**

---

*Built with [Mozaik](https://github.com/jigjoy-ai/mozaik).* 💖
