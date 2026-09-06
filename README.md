<div align="center">
  <img src="./assets/banner.jpg" alt="Metamorph Banner" width="100%" />

  # Metamorph
  **The Multi-Agent Migration CLI**

  [![npm version](https://img.shields.io/npm/v/@nikelyh/metamorph.svg?style=flat-square&color=blue&logo=npm)](https://www.npmjs.com/package/@nikelyh/metamorph)
  [![Powered by Mozaik](https://img.shields.io/badge/Powered%20by-Mozaik-6366f1.svg?style=flat-square&logo=github)](https://github.com/jigjoy-ai/mozaik)

  <p align="center">
    Refactor and migrate your entire codebase with zero risk and zero downtime.<br/>
    Powered by an elite swarm of autonomous agents.<br/><br/>
    📚 <b><a href="https://metamorph.nikelyh.tech/docs">Read the Full Documentation</a></b>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white" alt="Turborepo" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  </p>
</div>

---

## ❯ Overview

**Metamorph** is an advanced CLI tool designed to completely automate complex architectural shifts and framework migrations. Instead of relying on regular expressions or manual AST transformations, Metamorph orchestrates a swarm of specialized Agents (Mapper, Worker, Reviewer, and PackageManager) to semantically rewrite your code.

Every migration occurs inside a safe, isolated **Shadow Workspace** (`.metamorph/shadow`). Your original codebase remains completely untouched until you review the swarm's work and explicitly choose to apply the changes via a new Git branch.

## ❖ Monorepo Architecture

This project is built as a highly scalable monorepo using [Turborepo](https://turbo.build/):

- `apps/dashboard`: A local React dashboard used to visualize and monitor the AI swarm in real-time.
- `packages/@nikelyh/cli`: The command-line interface entry point distributed on NPM.
- `packages/@nikelyh/domain`: Core entities, events, and abstract ports following Hexagonal Architecture principles.
- `packages/@nikelyh/application`: Use cases and agent definitions (Mapper, Worker, Reviewer) powered by Mozaik.
- `packages/@nikelyh/infrastructure`: Concrete implementations of ports (File system operations, SQLite database, technology detection, and the local Express server).

## ⚡ Usage (For End Users)

If you just want to use Metamorph to migrate a project, simply install it globally via NPM:

```bash
npm install -g @nikelyh/metamorph
```

And run it inside any project directory:

```bash
metamorph run
```

To monitor the agents in real-time, open a new terminal in the same folder and run:
```bash
metamorph ui
```

### Other Commands

- `metamorph apply <runId> <targetPath>`: Applies a completed migration to your repository, creating a new git branch.
- `metamorph rollback <runId>`: Discards an unapplied migration and cleans up the shadow workspace.
- `metamorph list`: Lists all migration history.
- `metamorph detect [path]`: Detects frameworks and libraries in the current project.
- `metamorph reset`: Clears all migration history and events from the local database.

## 🔄 Supported Migrations

As Metamorph's AI capabilities are constantly expanding, the list of supported architectural shifts is updated frequently.

To see the complete, up-to-date list of all supported frontend and backend framework migrations, please visit our official documentation:

👉 **[View Supported Migrations](https://metamorph.nikelyh.tech/docs/migrations)**

## ⚙ Local Development

Want to contribute or modify Metamorph? Follow these steps to run the monorepo locally.

### Prerequisites
- Node.js >= 20
- npm >= 10.8

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yohanvillarp/metamorph.git
   cd metamorph
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your provider keys (e.g., OpenAI, Anthropic) as required by Mozaik.
   ```env
   OPENAI_API_KEY=sk-...
   ```

4. **Run the build pipeline:**
   ```bash
   npm run build
   ```

### Running Locally

To test the CLI from source without installing it globally, you can use the Turborepo dev script:

```bash
npm run dev
```
*(Alternatively, navigate to `packages/@nikelyh/cli` and run `npm run dev`)*.

## ⬡ Contributing

We welcome contributions! If you'd like to add support for a new framework migration (e.g., SvelteKit to Nuxt, Python Django to FastAPI), please open an issue first to discuss the architecture.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`npm run changeset`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---
<div align="center">
  <i>Built with Mozaik</i>
</div>
