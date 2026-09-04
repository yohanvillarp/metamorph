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

3.  **Abre un Pull Request (PR)**:
    Sube tu rama y abre un PR en GitHub apuntando **hacia la rama `develop`** (NO hacia `main`).
    ```bash
    git push origin feature/nombre-de-tu-feature
    ```

4.  **Revisión y CI**:
    Nuestras GitHub Actions correrán validaciones, linters y tests automáticamente. Una vez aprobado y en verde, se hará merge a `develop`.

5.  **Pase a Producción (`main`)**:
    Periódicamente, el equipo core creará un Pull Request desde `develop` hacia `main` para lanzar una nueva versión (Release).

## Entorno Local

Para empezar a desarrollar:
1. `npm install`
2. `npx turbo run build`
