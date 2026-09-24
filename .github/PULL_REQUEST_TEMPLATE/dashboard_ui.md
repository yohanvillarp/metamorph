## UI / Dashboard Scope & Motivation
<!-- Describe the visual, functional, or UX changes introduced to apps/dashboard -->

Fixes # <!-- Issue number, e.g. Fixes #112 -->

### FSD Layer(s) Affected
- [ ] `app/` (Providers, routers, global styles)
- [ ] `pages/` (Page route components, composition)
- [ ] `widgets/` (Composite UI blocks: SwarmView, Overview, EventLog, Queue, MigrationForm, NextStepsViewer)
- [ ] `features/` (Interactive user actions, modals, mutation handlers)
- [ ] `entities/` (Domain-specific UI models, card components, status badges)
- [ ] `shared/` (UI kit primitives, API client, hooks, utility functions)

---

## Visual & UX Changes
<!-- Summarize visual changes and include screenshots or ASCII mockups if applicable -->

### Before vs After:
- **Before**: 
- **After**: 

---

## UI Invariants & Design Standards Checklist
<!-- Metamorph enforces strict frontend design and architectural standards -->

- [ ] **Strict Zero-Emoji Rule**: Zero emojis or unicode icon characters in any component, label, tooltip, or badge. All visual metaphors use `lucide-react` vector icons exclusively.
- [ ] **Feature-Sliced Design (FSD)**: Dependency flow is strictly unidirectional (`shared` -> `entities` -> `features` -> `widgets` -> `pages` -> `app`). Zero horizontal or circular cross-imports within the same layer.
- [ ] **Polymorphic Package Manager Rendering**: CLI copy-paste commands and terminal snippets dynamically adapt to `plan.packageManager` (`pnpm`, `yarn`, `bun`, `npm`).
- [ ] **Real-time SSE Synchronization**: Event log and swarm state streams handle connection drops, reconnections, and high-frequency event bursts gracefully.
- [ ] **Accessibility & Responsiveness**: Keyboard navigable, accessible contrast ratios, and clean layout scaling across desktop viewport sizes.

---

## Testing & Verification
<!-- Describe testing steps in browser and typecheck verification -->

- [ ] `npm run typecheck` passes across the monorepo.
- [ ] `npm run build` succeeds (Vite production bundle generates with zero chunking warnings).
- [ ] Verified locally in browser (`http://localhost:5173` via `metamorph ui` or `npm run dev -- ui`).

```bash
# Verification commands:
npm run typecheck
npm run build
```
