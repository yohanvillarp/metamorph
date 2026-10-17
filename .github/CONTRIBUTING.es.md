*Read this in other languages: [English](CONTRIBUTING.md)*

# Guía de Contribución para Metamorph

¡Gracias por tu interés en contribuir a Metamorph! Para mantener el orden y la calidad del código, seguimos un flujo de trabajo estricto.

## Estrategia de Ramas (Git Flow)

Este repositorio utiliza el modelo estándar de Git Flow:

*   **`main`**: Es la rama de producción. Contiene únicamente código estable y testeado. **NUNCA se debe hacer commit directamente a esta rama.**
*   **`develop`**: Es la rama de integración. Todo el desarrollo activo (nuevas características, correcciones de errores) converge aquí antes de ir a producción.

### Flujo de Trabajo (Paso a Paso)

1.  **Crea una rama desde `develop`**:
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feature/nombre-de-tu-feature
    # O para arreglos: git checkout -b fix/nombre-del-fix
    ```

2.  **Haz tus cambios y realiza Commits Convencionales**:
    Todos los commits deben seguir la convención. Al hacer `git commit` se abrirá tu editor con nuestra plantilla (revisar `.gitmessage`).
    Ejemplo: `feat(cli): add new parallel processing flag`

3.  **Genera un Changeset (Versionado y Changelog)**:
    Si tu PR modifica código de paquetes (`packages/@nikelyh/*` o `apps/dashboard/*`), genera un changeset:
    ```bash
    npm run changeset
    ```
    Sigue las instrucciones interactivas para elegir el/los paquete(s) afectados y el nivel de incremento (`patch` para correcciones, `minor` para nuevas características).
    - **Cambios internos / Refactorización**: Si tu PR contiene limpieza de código o cambios internos que no ameritan un release en npm, ejecuta `npx changeset --empty` o añade la etiqueta `skip-changeset` a tu PR.
    - Si el PR solo modifica documentación o tests, no es necesario un changeset.

4.  **Abre un Pull Request (PR)**:
    Sube tu rama y abre un PR en GitHub apuntando **hacia la rama `develop`** (NO hacia `main`).
    ```bash
    git push origin feature/nombre-de-tu-feature
    ```
    Nuestros flujos automatizados asignarán las etiquetas pertinentes (`area: catalogs`, `area: domain`, etc.), etiquetas de tamaño de PR (`size/S`, `size/M`, `size/L`) y nuestro bot de Changeset verificará la presencia de tu release con una previsualización instantánea.
    Elige la plantilla de Pull Request adecuada desde `.github/PULL_REQUEST_TEMPLATE/` (o usa la predeterminada):
    - `feature.md`: Nuevas características y capacidades
    - `bugfix.md`: Corrección de errores con RCA y pruebas de regresión
    - `migration_target.md`: Agregar o actualizar pares de migración de frameworks
    - `swarm_agent.md`: Agentes Mozaik v4, dinámica de eventos y ciclo de vida
    - `dashboard_ui.md`: Interfaz web del dashboard, FSD y cumplimiento de cero emojis
    - `architecture.md`: Refactorización arquitectónica, límites y migraciones de esquema
    - `perf_optimization.md`: Cuellos de botella de rendimiento, benchmarks y profiling

5.  **Revisión y CI**:
    Nuestras GitHub Actions correrán validaciones, linters y tests automáticamente. Una vez aprobado y en verde, se hará merge a `develop`.

6.  **Pase a Producción (`main`)**:
    Periódicamente, el equipo core creará un Pull Request desde `develop` hacia `main` para lanzar una nueva versión (Release).

## Entorno Local

Para empezar a desarrollar:
1. `npm install`
2. `npx turbo run build`

## Estándares de Código y Arquitectura

Toda contribución debe respetar nuestros principios de ingeniería:
- **Pureza Hexagonal**: `@nikelyh/domain` tiene **cero dependencias de E/S** (sin filesystem, SQLite ni Express).
- **Responsabilidad Única (SRP)**: Funciones y clases pequeñas y enfocadas. Handlers concisos (< 50 líneas).
- **Tipado Estricto**: Prohibido el uso de `any`. Usa interfaces explícitas y `satisfies`.
- **Cero Strings Mágicos**: Emplea siempre enums y constantes tipadas (`SemanticEventName`, `PackageManagerType`).
- **Estándares del Dashboard**: Respeta Feature-Sliced Design (FSD) y usa iconos vectoriales (`lucide-react`, **estrictamente cero emojis**).

