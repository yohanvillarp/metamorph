import Fastify from 'fastify';

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 3000;

app.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

app.get('/api', async () => {
  return { message: 'Fastify Minimal Archetype API' };
});

app.get('/api/users', async () => {
  return {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ],
  };
});

app.listen({ port }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});

export { app };
