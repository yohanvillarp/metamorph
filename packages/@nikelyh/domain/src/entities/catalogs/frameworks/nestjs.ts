import type { FrameworkPack } from './types';

export const nestjsPack: FrameworkPack = {
  contract: ['NestJS boots with NestFactory.create() and a root @Module.'],
  components: ['@Module, @Controller, @Injectable must stay wired: controllers, providers, and imports together.'],
  routing: ['HTTP routes are controller methods. Preserve method, path, and status when mapping away from Nest.'],
  styling: [],
  antiPatterns: ['Do not leave an empty AppModule that imports nothing the old module imported.'],
};
