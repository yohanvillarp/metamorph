/**
 * Driving Port: Interface for interacting with the core logic of Metamorph.
 * Defines the commands or operations that external actors (CLI, Web) can request.
 */
export interface MigrationCommand {
  /**
   * Starts a code migration process.
   * @param sourceFramework Source framework (e.g., 'express')
   * @param targetFramework Target framework (e.g., 'fastify')
   * @param sourcePath Source code path
   */
  startMigration(sourceFramework: string, targetFramework: string, sourcePath: string): Promise<void>;
}
