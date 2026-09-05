/**
 * Entity that defines the characteristics of the migration to be performed.
 * For example: From "express" to "fastify".
 */
export interface MigrationProfile {
  /**
   * Source framework or technology.
   * Ex: 'express', 'react', 'javascript'
   */
  source: string;

  /**
   * Target framework or technology.
   * Ex: 'fastify', 'vue', 'typescript'
   */
  target: string;

  /**
   * Optional custom rules or guidelines for the agents.
   * Ex: ["Change res.json() to reply.send()"]
   */
  rules?: string[];
}
