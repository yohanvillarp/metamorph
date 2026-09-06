# 🦋 Metamorph CLI

**The AI Multi-Agent Migration CLI**

Metamorph is a revolutionary CLI tool powered by [Mozaik AI](https://github.com/jigjoy-ai/mozaik) that automates complex architectural shifts and framework migrations in your codebase. Instead of doing it manually, Metamorph spawns a swarm of specialized AI agents that safely refactor your code in an isolated "Shadow Workspace".

## 🚀 Features

- **Multi-Agent Concurrency**: Utilizes Mapper, Worker, Reviewer, and PackageManager agents to migrate code flawlessly.
- **Zero Risk**: All migrations happen in a `.metamorph/shadow` workspace. Your original code is completely untouched until you explicitly approve and integrate the changes.
- **Visual Dashboard**: Watch your agents work in real-time through the built-in local dashboard UI.
- **Extensive Framework Support**: Easily migrate between popular frameworks.

## 📦 Installation

Install Metamorph globally via NPM:

```bash
npm install -g @nikelyh/metamorph
```

## 🛠️ Usage

Navigate to the project you want to migrate and run:

```bash
metamorph run
```

Metamorph will automatically detect your current stack and prompt you to select the target framework. 
Once started, the AI swarm will begin working in the background.

### View the Dashboard

To see the real-time progress of your AI agents, open a new terminal in the same folder and run:

```bash
metamorph ui
```
This will start the internal dashboard and open it in your browser.

### Other Commands

- `metamorph apply <runId> <targetPath>`: Applies a completed migration to your repository, creating a new git branch.
- `metamorph rollback <runId>`: Discards an unapplied migration and cleans up the shadow workspace.
- `metamorph list`: Lists all migration history.
- `metamorph detect [path]`: Detects frameworks and libraries in the current project.
- `metamorph reset`: Clears all migration history and events from the local database.

## 🔄 Supported Migrations

**Backend Refactoring**
- Express ⇄ Fastify
- Express ➔ NestJS
- Fastify ➔ NestJS

**Frontend Modernization**
- React ➔ Next.js
- Vue ➔ React
- Vue ➔ Next.js
- Angular ➔ React
- Svelte ➔ Next.js

---
*Built with ❤️ using Mozaik.*
