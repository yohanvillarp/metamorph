import { Agent, Tool } from '@mozaik-ai/core';
import {
  SwarmAgentId,
  MetamorphConfig,
  isCoreAgentId,
} from '@nikelyh/domain';

import { createMapperAgent } from '../MapperAgent';
import { createWorkerAgent } from '../WorkerAgent';
import { createReviewerAgent, createReviewerBypassAgent } from '../reviewer/ReviewerAgent';
import { createPackageManagerAgent } from '../PackageManagerAgent';
import { createCoordinatorAgent } from '../CoordinatorAgent';
import { createReporterAgent, createFallbackReporterAgent } from '../ReporterAgent';
import { createIntegrationAgent } from '../IntegrationAgent';
import { createAccountingAgent } from '../AccountingAgent';

export interface AgentFactoryContext {
  tools: Tool[];
  config?: MetamorphConfig;
}

export interface AgentDescriptor {
  id: SwarmAgentId;
  name: string;
  category: 'core' | 'auxiliary';
  consumesTokens: boolean;
  description: string;
  factory: (context: AgentFactoryContext) => Agent;
  fallbackFactory?: (context: AgentFactoryContext) => Agent | null;
}

/**
 * Centralized declarative registry of all swarm agents in Metamorph.
 */
export const AGENT_DESCRIPTORS: readonly AgentDescriptor[] = [
  {
    id: 'mapper',
    name: 'Mapper',
    category: 'core',
    consumesTokens: false,
    description: 'Discovers project files and builds the initial task queue',
    factory: () => createMapperAgent(),
  },
  {
    id: 'worker',
    name: 'Worker',
    category: 'core',
    consumesTokens: true,
    description: 'Executes file-by-file AST and source migrations',
    factory: (ctx) => createWorkerAgent(ctx.tools),
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    category: 'auxiliary',
    consumesTokens: true,
    description: 'Inspects transformed code with syntax, neighbor, and LLM review passes',
    factory: (ctx) => createReviewerAgent(ctx.tools),
    fallbackFactory: () => createReviewerBypassAgent(),
  },
  {
    id: 'packagemanager',
    name: 'PackageManager',
    category: 'core',
    consumesTokens: false,
    description: 'Analyzes dependencies and updates package.json safely on disk',
    factory: () => createPackageManagerAgent(),
  },
  {
    id: 'coordinator',
    name: 'Coordinator',
    category: 'core',
    consumesTokens: false,
    description: 'Orchestrates swarm synchronization, watchdogs, and phase transitions',
    factory: () => createCoordinatorAgent(),
  },
  {
    id: 'reporter',
    name: 'Reporter',
    category: 'auxiliary',
    consumesTokens: true,
    description: 'Drafts human-facing MIGRATION.md changelog and application instructions',
    factory: (ctx) => {
      const reporterTools = ctx.tools.filter(
        (tool) =>
          tool.name === 'read_file' ||
          tool.name === 'write_file' ||
          tool.name === 'list_directory'
      );
      return createReporterAgent(reporterTools);
    },
    fallbackFactory: () => createFallbackReporterAgent(),
  },
  {
    id: 'integration',
    name: 'IntegrationAgent',
    category: 'core',
    consumesTokens: true,
    description: 'Installs dependencies in shadow workspace, validates build, and performs repair passes',
    factory: (ctx) => createIntegrationAgent(ctx.tools),
  },
  {
    id: 'accounting',
    name: 'AccountingAgent',
    category: 'auxiliary',
    consumesTokens: false,
    description: 'Captures and tallies exact LLM token counts and dollar cost estimations',
    factory: () => createAccountingAgent(),
    fallbackFactory: () => null,
  },
] as const;

export class AgentRegistry {
  private static descriptors: Map<SwarmAgentId, AgentDescriptor> = new Map(
    AGENT_DESCRIPTORS.map((d) => [d.id, d])
  );

  static getDescriptor(id: SwarmAgentId): AgentDescriptor | undefined {
    return this.descriptors.get(id);
  }

  static getAllDescriptors(): readonly AgentDescriptor[] {
    return AGENT_DESCRIPTORS;
  }

  static isAgentDisabled(id: SwarmAgentId, config?: MetamorphConfig): boolean {
    if (isCoreAgentId(id)) return false;
    if (!config?.disabledAgents) return false;
    return config.disabledAgents.includes(id as any);
  }

  /**
   * Resolves the list of active agents to join, activating deterministic fallbacks for disabled auxiliary agents.
   */
  static resolveSwarmAgents(context: AgentFactoryContext): {
    agentsToJoin: Agent[];
    disabledAgents: { id: SwarmAgentId; mode: string }[];
  } {
    const agentsToJoin: Agent[] = [];
    const disabledAgents: { id: SwarmAgentId; mode: string }[] = [];

    for (const descriptor of AGENT_DESCRIPTORS) {
      const isDisabled = this.isAgentDisabled(descriptor.id, context.config);

      if (!isDisabled) {
        agentsToJoin.push(descriptor.factory(context));
      } else {
        if (descriptor.fallbackFactory) {
          const fallback = descriptor.fallbackFactory(context);
          if (fallback) {
            agentsToJoin.push(fallback);
            disabledAgents.push({ id: descriptor.id, mode: '0-token deterministic fallback' });
          } else {
            disabledAgents.push({ id: descriptor.id, mode: 'completely disabled' });
          }
        } else {
          disabledAgents.push({ id: descriptor.id, mode: 'completely disabled' });
        }
      }
    }

    return { agentsToJoin, disabledAgents };
  }
}
