/**
 * Core domain logic for agents.
 * 
 * Agentes Mozaik que trabajarán de forma paralela en la migración.
 * Cada agente se suscribirá a eventos relevantes en el bus.
 */

// Ejemplo de un tipo/interfaz central
export interface MigrationEvent {
  type: string;
  payload: any;
  timestamp: Date;
}

// TODO: Implementar clases Mozaik (Agent, EventBus) cuando @mozaik-ai/core esté listo
