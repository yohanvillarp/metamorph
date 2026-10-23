import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();
const port = Number(process.env.PORT) || 3000;

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api', (c) => {
  return c.json({ message: 'Hono Minimal Archetype API' });
});

app.get('/api/users', (c) => {
  return c.json({
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ],
  });
});

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export { app };
