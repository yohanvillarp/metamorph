---
"@nikelyh/metamorph": minor
---

Dashboard now receives migration activity live over Server-Sent Events instead of polling the API every second.

- `metamorph ui` exposes `GET /api/events/stream`; the dashboard subscribes to it after one initial fetch, so swarm events and task status appear as they happen with far fewer requests.
- If the stream is unavailable (older server, proxy that blocks it, dropped connection) the dashboard automatically falls back to the previous polling behaviour and catches up when the stream returns.
- Runs started from the CLI in another terminal still show up: the dashboard re-syncs every 10 seconds while streaming.
