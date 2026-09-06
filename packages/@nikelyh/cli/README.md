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

📚 **[Read the Full Documentation](https://metamorph.nikelyh.tech/docs)**

## 🚀 Features

- **Multi-Agent Concurrency**: Utilizes Mapper, Worker, Reviewer, and PackageManager agents to migrate code.
- **Zero Risk**: All migrations happen in a `.metamorph/shadow` workspace. Your original code is completely untouched until you explicitly approve and integrate the changes.
- **Visual Dashboard**: Watch your agents work in real-time through the built-in local dashboard UI.
- **Extensive Framework Support**: Easily migrate between popular frameworks automatically.

## 📦 Installation

Install Metamorph globally via NPM:

```bash
npm install -g @nikelyh/metamorph
```

## 🛠️ Typical Workflow

You can run the entire migration lifecycle using just your terminal. 

### 1. Help & Options
To see all available commands and options at any time, run:
```bash
metamorph --help
```

### 2. Start a Migration
Navigate to the root of the project you want to migrate and run:
```bash
metamorph run
```
Metamorph will automatically detect your current stack (e.g. Express, React) and prompt you to select the target framework. Alternatively, you can bypass the interactive prompt by passing the source explicitly:
```bash
metamorph run --from express
```

### 3. Monitor the Agents (Dashboard UI)
Once a migration is running, the AI swarm begins working in the background. To see their real-time progress, open a **new terminal tab** in the same folder and run:
```bash
metamorph ui
```
This will start the internal dashboard server and open a Neo-Brutalist interface in your default browser. You can specify a port with `--port 8080`.

### 4. Review and Apply
After the AI finishes the migration in the isolated Shadow Workspace, you will receive a `runId`. You can apply the completed migration to your actual repository (which automatically creates a new git branch for safety):
```bash
metamorph apply <runId> .
```

### 5. Managing Migrations
If you want to discard a run without applying it:
```bash
metamorph rollback <runId>
```
To see a history of all migrations:
```bash
metamorph list
```
To clear the local database and reset all events:
```bash
metamorph reset
```

### Utility Commands
To test the technology detection on your repository without starting a migration:
```bash
metamorph detect .
```

## 🔄 Supported Migrations

As Metamorph's AI capabilities are constantly expanding, the list of supported architectural shifts is updated frequently.

To see the complete, up-to-date list of all supported frontend and backend framework migrations, please visit our official documentation:

👉 **[View Supported Migrations](https://metamorph.nikelyh.tech/docs/migrations)**

---
*Built with ❤️ using Mozaik.*
