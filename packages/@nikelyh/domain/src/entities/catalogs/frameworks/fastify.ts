import type { FrameworkPack } from './types';

export const fastifyPack: FrameworkPack = {
  contract: ['Fastify apps register plugins and route options.'],
  components: ['Preserve schema validation when mapping to/from Express or Nest.'],
  routing: ['Preserve path + method on each route.'],
  styling: [],
  antiPatterns: [],
};
