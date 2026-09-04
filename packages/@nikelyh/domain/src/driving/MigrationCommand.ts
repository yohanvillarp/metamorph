/**
 * Driving Port: Interfaz para interactuar con la lógica central de Metamorph.
 * Define los comandos u operaciones que actores externos (CLI, Web) pueden solicitar.
 */
export interface MigrationCommand {
  /**
   * Inicia un proceso de migración de código.
   * @param sourceFramework Framework de origen (ej. 'express')
   * @param targetFramework Framework destino (ej. 'fastify')
   * @param sourcePath Ruta del código fuente
   */
  startMigration(sourceFramework: string, targetFramework: string, sourcePath: string): Promise<void>;
}
