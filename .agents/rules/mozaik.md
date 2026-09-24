---
name: Mozaik Documentation Reference
description: Centralized index and architectural guide for understanding the Mozaik framework.
---

# Mozaik Context & Reference

Metamorph uses **Mozaik v4**, a TypeScript runtime for interoperable AI agents based on an event-driven architecture.

**CRITICAL RULE FOR AI AGENTS:** 
Do not attempt to memorize the entire API or invent methods that do not exist. When you need to implement or modify a specific Mozaik feature, you **MUST read the corresponding local file** using your file reading tools before writing any code.

## Knowledge Index

All official documentation is available in the `docs/mozaik/` folder. Use it strategically:

### 1. Core Concepts & State
If you need to instantiate the server or modify the global state:
- `docs/mozaik/Runtime.md`: How to setup `defineRuntime` and `initializeRuntime`.
- `docs/mozaik/Runtime state.md`: The typed global store shared by everyone.
- `docs/mozaik/Participants.md`: Humans, Agents, and Observers (`createAgent`, `createHuman`).

### 2. Events & Reactions
If you need an agent to listen to others or act:
- `docs/mozaik/Semantic events.md`: Event types in the bus (`message.sent`, `model.answer`, etc.).
- `docs/mozaik/Situation handlers.md`: How to define `SituationSpecification` and its `Processor`.

### 3. Execution & Inference
If you need to start an agent's thinking process or alter its flow:
- `docs/mozaik/The agent loop.md`: The state machine of `runLoop`.
- `docs/mozaik/Interception.md`: How to veto, pause, or redirect steps in the loop.
- `docs/mozaik/Model context.md`: Context window and memory manipulation.

### 4. Advanced
- `docs/mozaik/Tools.md`: Creating custom tools and MCP servers.
- `docs/mozaik/Structured output.md`: Forcing the LLM to return JSON schemas.

## Core Architectural Principles (Do not break)
1. **Agents are not called, they react**: Do not try to "execute" an agent directly. Agents listen to events (via `SituationHandlers`) and decide for themselves to act.
2. **Fire-and-forget**: NEVER use `await runLoop()` or `await sendMessage()`. Mozaik is concurrent and non-blocking.
3. **Identity vs Behavior**: Identity is the agent's manifest. Behavior is the *handlers* injected into it. Do not use class inheritance to define behaviors.

*Note:* If you need a quick conceptual recap without reading the full API, review `docs/mozaik/hyperskill-course.es.md`.
