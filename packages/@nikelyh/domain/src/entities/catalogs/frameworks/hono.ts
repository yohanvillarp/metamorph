import type { FrameworkPack } from './types';

export const honoPack: FrameworkPack = {
  contract: [
    'Hono apps create an instance with new Hono() and use @hono/node-server serve() to listen.',
    'Entry point must import { Hono } from "hono" and import { serve } from "@hono/node-server".',
  ],
  components: [
    'Route handlers receive a Context object (c). Use c.json(), c.text(), c.html() for responses.',
    'Middleware uses app.use() with (c, next) => signature, not Express (req, res, next).',
  ],
  routing: [
    'Preserve path + method on each route. Hono uses app.get(), app.post(), etc.',
    'Route grouping uses app.route("/prefix", subApp) instead of Express Router or Fastify plugins.',
  ],
  styling: [],
  antiPatterns: [
    'Do not leave Express res.json()/res.send() calls — Hono uses c.json()/c.text() via the Context.',
    'Do not use require("http").createServer() — Hono on Node uses serve() from @hono/node-server.',
  ],
};
