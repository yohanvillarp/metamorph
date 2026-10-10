import { Command } from 'commander';

export interface RunCommandOptions {
  from?: string;
  to?: string;
  model?: string;
  reviewerModel?: string;
  concurrency?: string;
  timeout?: string;
  retries?: string;
  integrationRounds?: string;
  disableAgents?: string;
}

export const SUPPORTED_MIGRATIONS: Record<string, string[]> = {
  express: ['fastify', 'nestjs', 'hono'],
  fastify: ['express', 'nestjs', 'hono'],
  nestjs: ['express', 'fastify', 'hono'],
  hono: ['express', 'fastify', 'nestjs'],
  react: ['next', 'vue', 'angular', 'svelte'],
  next: ['react', 'vue', 'angular', 'svelte'],
  vue: ['react', 'next', 'angular', 'svelte'],
  angular: ['react', 'next', 'vue', 'svelte'],
  svelte: ['react', 'next', 'vue', 'angular'],
};

export function configureRunOptions(cmd: Command): Command {
  return cmd
    .option('--from <source>', 'Source framework (e.g. express)')
    .option('--to <target>', 'Target framework (e.g. fastify)')
    .option('--model <model>', 'LLM model to use for worker agents (e.g. gpt-5.4, claude-sonnet-4-6)')
    .option('--reviewer-model <model>', 'LLM model specifically for reviewer agent')
    .option('--concurrency <number>', 'Number of concurrent agent workers (e.g. 5)')
    .option('--timeout <seconds>', 'Inference timeout in seconds (e.g. 180)')
    .option('--retries <number>', 'Maximum repair retries per file (e.g. 3)')
    .option('--integration-rounds <number>', 'Maximum shadow build integration rounds (e.g. 4)')
    .option('--disable-agents <agents>', 'Comma-separated list of auxiliary agents to disable (e.g. reporter, reviewer, accounting)');
}
