---

## **METAMORPH — Visión del Producto**

**Nombre**: METAMORPH  
**Categoría**: Migrador de Tecnología Automático (Herramienta CLI + Dashboard)  
**Stack**: Node.js + Mozaik + TypeScript + React (Web)

---

### **¿Qué es Metamorph?**

Metamorph es una herramienta diseñada para resolver uno de los problemas más costosos y temidos en la ingeniería de software: **la migración de frameworks y tecnologías legacy**. 
*(Ejemplo: Migrar un backend monolítico de Express a Fastify, refactorizar JavaScript a TypeScript puro, o actualizar APIs deprecadas).*

En lugar de depender de scripts frágiles (codemods) o semanas de trabajo manual, Metamorph utiliza un enjambre de **Agentes de IA concurrentes** (orquestados por Mozaik) que leen, analizan, reescriben y validan el código simultáneamente.

---

### **Entrada**
- **CLI**: `npx metamorph run ./src --from express --to fastify`
- **Web**: Subir o conectar la base de código + Interfaz interactiva de progreso.

---

### **Gestión de Estados (Shadow Workspace)**

Para dar seguridad total al desarrollador y mitigar el riesgo inherente de las migraciones impulsadas por IA, METAMORPH implementa un entorno sin riesgo conocido como **Shadow Workspace**. 

**¿Cómo funciona?**
1. **Snapshot Inicial:** Antes de tocar el código del usuario, el sistema aísla los archivos originales copiándolos a un directorio temporal (caché).
2. **Prueba A/B (Dual-State):** Los agentes evalúan tanto la versión *original* como la *nueva* en paralelo dentro de este espacio sombra.
3. **Comparación Interactiva:** El usuario puede ejecutar `metamorph diff` en la terminal para revisar los cambios exactos archivo por archivo (estilo Git), o ver el comparativo visual en el Web Dashboard antes de aceptarlos.
4. **Restablecimiento Inmediato (Rollback):** Si el desarrollador rechaza la migración o algún agente reporta un error crítico incorregible, el "Shadow Workspace" simplemente se descarta, dejando la base de código local 100% intacta.

---

### **Salida**

**CLI**: 
```text
✓ Migración completada
✓ 45 Archivos procesados exitosamente
✓ 0 Errores de compilación en el Shadow Workspace
→ Escribe 'metamorph diff' para revisar, o presiona 'Y' para aplicar los cambios a tu repositorio.
```

**Web Dashboard**: 
- Línea de tiempo (timeline) de los eventos semánticos en vivo.
- Interfaz de "Diff" interactiva (comparación lado a lado de código viejo vs nuevo).
- Estado de los agentes trabajadores (Qué archivo está analizando cada uno).

---

*(Para los detalles técnicos sobre el funcionamiento dinámico de los agentes y la infraestructura, revisa `docs/architecture.md`)*