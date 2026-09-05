import Fastify, { FastifyRequest, FastifyReply } from 'fastify';

const app = Fastify();
const port = 3000;

app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
  console.log('Request received at', request.url);
  return reply.send('Hello World!');
});

app.listen({ port }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Fastify app listening on ${address}`);
});
