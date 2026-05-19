# PracticExample

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## Seguridad

Este proyecto es material docente del curso **Desarrollo Seguro Avanzado** dictado por **Kibernum IT Academy** al cliente **Banmédica** (Chile). El pipeline DevSecOps acordado en la minuta del 26 de marzo de 2026 se ejecuta automáticamente vía GitHub Actions.

### Documentación

- **[docs/PIPELINE.md](docs/PIPELINE.md)** — explicación etapa por etapa del workflow [.github/workflows/ci-security.yml](.github/workflows/ci-security.yml), con referencias OWASP Top 10 2021 y cómo leer los hallazgos en la pestaña Security.
- **[docs/SECURITY.md](docs/SECURITY.md)** — racional de las decisiones de seguridad ya implementadas en el código (JWT dual-token, SafeLogger, guards en cascada, headers de nginx, Dockerfile hardened).
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — etapas pendientes con Banmédica (DAST Bright, SBOM Syft, Grype, Cosign, deploy a K8s).

### Activación manual en `Settings → Code security and analysis`

El workflow del CI cubre lo automatizable, pero algunas funciones nativas de GitHub deben **activarse manualmente** desde la UI del repositorio por una persona con permisos de admin:

1. Ir a **Settings → Code security and analysis**.
2. Activar, en este orden:

   | Función | Para qué sirve | Acción |
   |---|---|---|
   | **Dependency graph** | Construye el grafo de dependencias del proyecto. Es prerequisito de las dos siguientes. | `Enable` |
   | **Dependabot alerts** | Alerta cuando aparece un CVE en una dependencia declarada en `package.json` o `pnpm-lock.yaml`. Visible en `Security → Dependabot alerts`. | `Enable` |
   | **Dependabot security updates** | Convierte las alertas anteriores en PRs automáticas con el bump al mínimo de versión parcheada. | `Enable` |
   | **Secret scanning** | Detecta tokens, llaves privadas y contraseñas en commits, issues, PRs y comentarios. Visible en `Security → Secret scanning alerts`. | `Enable` |
   | **Push protection** | Bloquea el `git push` cuando detecta un secret antes de que toque el remoto. Es la mitigación más fuerte. | `Enable` |

3. **Code scanning** (CodeQL) **NO** se activa desde aquí — ya está configurado vía workflow en [.github/workflows/ci-security.yml](.github/workflows/ci-security.yml) (job `sast-codeql`). El primer push a `main` poblará la pestaña `Security → Code scanning alerts`.

4. **Dependabot version updates** se configura por archivo en [.github/dependabot.yml](.github/dependabot.yml) (ya incluido) — NO requiere acción en la UI.

### Ejecutar el pipeline manualmente

Desde **Actions → CI · Seguridad → Run workflow** (gracias al trigger `workflow_dispatch`). Útil para validar cambios de configuración antes de pushear código.

### Comandos locales equivalentes

```bash
pnpm install --frozen-lockfile   # mismo install que el CI
pnpm lint                        # mismo lint que el CI
pnpm test:ci                     # tests con coverage
pnpm audit --audit-level=high --prod  # mismo gate SCA que el CI
```

CodeQL y hadolint solo corren en CI — no tienen equivalente local trivial.
