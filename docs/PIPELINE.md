# Pipeline DevSecOps · CI/CD del SPA Angular

> Material docente del curso **Desarrollo Seguro Avanzado** (40 horas) dictado por **Kibernum IT Academy** al cliente **Banmédica** (Chile). Stack acordado en la minuta del 26 de marzo de 2026.

Este documento explica el workflow [.github/workflows/ci-security.yml](../.github/workflows/ci-security.yml) etapa por etapa: qué hace cada job, qué riesgo de seguridad mitiga, qué OWASP Top 10 2021 cubre y dónde leer los resultados en la pestaña **Security** del repositorio.

---

## 1. Diagrama del flujo de jobs

```
                                  ┌─────────────────────────┐
                                  │     install-and-lint    │
                                  │  pnpm install + lint    │
                                  └────────────┬────────────┘
                                               │ (needs)
            ┌──────────────────────────────────┼──────────────────────────────────┐
            ▼                                  ▼                                  ▼
   ┌─────────────────┐               ┌──────────────────┐               ┌──────────────────┐
   │      test       │               │   sast-codeql    │               │    sca-audit     │
   │ pnpm test:ci    │               │ CodeQL TS/JS +   │               │ pnpm audit       │
   │ + coverage      │               │ security-extended│               │ --prod --high    │
   └────────┬────────┘               └─────────┬────────┘               └─────────┬────────┘
            │                                  │                                  │
            │           ┌──────────────────────┴──────────────────────┐           │
            │           ▼                                             │           │
            │ ┌──────────────────┐    (en paralelo, sin needs)        │           │
            │ │ dockerfile-lint  │                                    │           │
            │ │ hadolint → SARIF │                                    │           │
            │ └──────────┬───────┘                                    │           │
            │            │                                            │           │
            └────────────┴──────────────┬─────────────────────────────┴───────────┘
                                        ▼
                            ┌─────────────────────────┐
                            │      docker-build       │
                            │  build local (push=false│
                            │  + cache GHA)           │
                            └────────────┬────────────┘
                                         │ (solo si branch == main)
                                         ▼
                            ┌─────────────────────────┐
                            │      push-to-ghcr       │
                            │  login + push :sha-XYZ  │
                            │  + :latest              │
                            └─────────────────────────┘
```

- `install-and-lint` es el primer gate: si el código no parsea o falla lint, los demás jobs no arrancan.
- Los tres jobs de análisis (`test`, `sast-codeql`, `sca-audit`) corren en paralelo. `dockerfile-lint` no depende de nada y arranca desde el segundo cero.
- `docker-build` exige que los cuatro análisis hayan pasado.
- `push-to-ghcr` solo se ejecuta cuando el evento es un push a `main` (las PRs no publican imágenes).

---

## 2. Qué detecta cada herramienta sobre este proyecto

| Herramienta | Qué detecta concretamente en este proyecto | Referencia OWASP 2021 | Dónde leer los resultados |
|---|---|---|---|
| **ESLint flat config** ([eslint.config.js](../eslint.config.js)) | Uso de `eval`, `Function()`, `javascript:` URLs en `src/app/**/*.ts`; selectores Angular con prefijo distinto a `app`; uso de `any` (warn); reglas de accesibilidad WCAG AA sobre `*.html` (alt en imágenes, label en inputs, etc.). | A03 Injection · A05 Misconfiguration | Logs del job `install-and-lint` en la pestaña **Actions** |
| **Vitest + coverage** (job `test`) | Regresiones funcionales del único spec `src/app/app.spec.ts`. Mide cobertura pero **no** la bloquea (base de tests mínima — ver [ROADMAP.md](./ROADMAP.md)). | A04 Insecure Design (cobertura como métrica auxiliar) | Artifact `coverage-<sha>` en la página de la ejecución |
| **CodeQL `security-extended`** ([codeql-config.yml](../.github/codeql/codeql-config.yml)) | XSS via interpolación insegura en componentes; tokens JWT en `localStorage` (verifica que [auth.service.ts](../src/app/core/auth/auth.service.ts) los mantenga en signal); SSRF en `HttpClient` con URL dinámica; uso de `Math.random` para generar valores sensibles; prototype pollution en utilities. | A03 Injection · A07 Auth Failures · A08 Data Integrity | Pestaña **Security → Code scanning alerts** |
| **pnpm audit** (job `sca-audit`) | CVEs `high` y `critical` en dependencias de producción listadas en [package.json](../package.json) (`@angular/*`, `bootstrap`, `rxjs`, `tslib`). Ignora devDependencies (`vitest`, `eslint`, etc.) — sus CVEs no llegan a runtime. | A06 Vulnerable Components | Logs del job + artifact `pnpm-audit-<sha>` |
| **Dependabot** ([dependabot.yml](../.github/dependabot.yml)) | Mismo objetivo que `pnpm audit` pero proactivo: cada lunes 06:00 (America/Santiago) escanea registries y abre PRs cuando aparece una versión nueva o un CVE. Cubre ecosystem `npm` (incluye `pnpm-lock.yaml`) y `github-actions`. | A06 Vulnerable Components | Pestaña **Security → Dependabot alerts** y **Pull requests** |
| **Hadolint** (job `dockerfile-lint`) | Antipatrones en [Dockerfile](../Dockerfile): falta de `--no-cache`, uso de `latest`, `USER root` no revertido, `COPY .` sin `.dockerignore`. El Dockerfile ya implementa estos patrones; el job los protege contra regresiones futuras. | A05 Misconfiguration | Pestaña **Security → Code scanning alerts** (categoría `hadolint`) |
| **Secret Scanning** (nativo GitHub) | Tokens AWS, llaves de Azure, GitHub PATs, claves privadas, conexiones de DB hardcodeadas en cualquier commit. Bloquea el push si está activado **Push Protection**. | A02 Cryptographic Failures · A07 Auth Failures | Pestaña **Security → Secret scanning alerts** |
| **GitHub Actions permissions** | El workflow declara `permissions: contents: read` a nivel global y eleva solo lo necesario por job (`security-events: write` en CodeQL/Hadolint, `packages: write` en push). Mitiga el escalado de privilegios si una action de terceros es comprometida. | A01 Broken Access Control | Auditoría visible en el YAML del workflow |

---

## 3. Qué NO detecta este pipeline (huecos conocidos)

Estos huecos son **intencionales** en la iteración actual y se documentan para que el alumno entienda dónde termina la cobertura estática y empieza la dinámica.

| Hueco | Por qué no se cubre hoy | Cuándo se cubrirá |
|---|---|---|
| **Errores de runtime en producción** | SAST y SCA son estáticos: no ejecutan el código contra una instancia real. Si la app rompe en runtime por una race condition o un fetch fallido, el pipeline lo deja pasar. | Cubierto por **Bright DAST** cuando Banmédica provisione el escáner (ver [ROADMAP.md](./ROADMAP.md)). |
| **CSP rota en runtime** | La directiva CSP en [nginx.conf](../nginx.conf) es válida sintácticamente, pero CodeQL no verifica que el navegador no la rompa en producción (ej. un bundle de Bootstrap que cargue un script inline bloqueado). | Bright DAST (cabeceras de respuesta reales). |
| **Race conditions reales del refresh token** | El gate de `BehaviorSubject` en [auth.service.ts](../src/app/core/auth/auth.service.ts) está bien implementado, pero CodeQL no ejecuta concurrencia real para verificar que dos requests en vuelo no disparen dos refresh. | Test E2E con Playwright (no incluido aún) + Bright DAST. |
| **Vulnerabilidades de lógica de negocio** | Que un usuario `patient` no pueda crear citas de otro paciente es una decisión de lógica de dominio. Ningún SAST genérico lo detecta — requiere conocimiento del modelo de roles. | Tests de integración del backend NestJS + test E2E del SPA. |
| **Headers de respuesta del servidor real** | El job `dockerfile-lint` valida sintaxis del Dockerfile, no la respuesta HTTP real. Si nginx no aplica un header por un error de config, este pipeline no lo detecta. | Bright DAST (escaneo HTTP en vivo). |
| **SBOM (inventario de software de la imagen)** | No se genera con Syft porque está pendiente de aprobación. | Listado pendiente de envío a Bárbara (Banmédica). |
| **Escaneo de la imagen Docker compilada** | Grype no está activado (Trivy bloqueado, Grype pendiente). | Pendiente listado a Banmédica. |
| **Firma de la imagen** | Cosign no está en el acuerdo todavía. | Pendiente listado a Banmédica. |
| **Cobertura de tests > 0%** | Solo existe `src/app/app.spec.ts` en 39 archivos TS. El job `test` lo reporta pero no bloquea. | Iteración pedagógica posterior (escribir specs por feature). |

---

## 4. Cómo leer los hallazgos

### 4.1 Code scanning alerts (CodeQL + Hadolint)

1. Repositorio → **Security** → **Code scanning alerts**.
2. Cada alerta muestra: severidad, categoría CWE, archivo y línea, descripción + corrección sugerida.
3. Filtros útiles: `tool:CodeQL`, `tool:hadolint`, `severity:critical`, `branch:main`.
4. Para cerrar una alerta:
   - **Fix**: aplicar la corrección sugerida en una PR. Al hacer merge a `main`, CodeQL re-analiza y la alerta pasa a `Closed (fixed)`.
   - **Dismiss**: solo si es falso positivo. Documenta la razón en el comentario obligatorio.

### 4.2 Dependabot alerts

1. **Security** → **Dependabot alerts**.
2. Cada alerta corresponde a un CVE asociado a una versión de una dependencia. Detalle: paquete, versión vulnerable, versión parcheada, GHSA-ID.
3. Si Dependabot puede parchear, aparece una PR automática con el bump en `pnpm-lock.yaml`. Revisar el CHANGELOG del paquete antes de aprobar.
4. Si no hay versión parcheada, el alumno debe evaluar:
   - ¿La superficie afectada se usa en este proyecto? (`pnpm why <paquete>`)
   - ¿Hay workaround a nivel de código?
   - Si no, marcar la alerta como `won't fix` y documentar el riesgo aceptado.

### 4.3 Secret scanning alerts

1. **Security** → **Secret scanning alerts**.
2. Cada alerta señala un secret detectado en un commit (token, llave privada, contraseña).
3. **Push Protection** (activable en `Settings → Code security`) **bloquea** el push antes de que el secret toque el remoto.
4. Si una alerta aparece sobre un commit ya en `main`:
   - **Revocar** el secret en el proveedor (AWS, Azure, GitHub, etc.) — el rotado es la única remediación real.
   - Reescribir el historial con `git filter-repo` solo si el repo es privado y ningún clon externo tiene la copia.

---

## 5. Cómo iterar cuando el pipeline rompe

Pasos recomendados cuando una PR cae en rojo:

1. **Mira primero el job que rompió** (badge rojo en la lista de Actions). El orden de dependencias significa que el primer rojo es el origen — los siguientes pueden romper en cascada.
2. **Cuatro orígenes habituales**:

| Job rojo | Causa típica | Cómo investigarlo |
|---|---|---|
| `install-and-lint` | Cambios en `package.json` sin actualizar `pnpm-lock.yaml`, o un nuevo error de lint introducido por la PR. | Localmente: `pnpm install --frozen-lockfile` y `pnpm lint`. Si lint falla, los archivos exactos están en el log del job. |
| `test` | Spec roto por un cambio de signature en `AuthService` o `SafeLogger`. | `pnpm test:ci`. Mirar el output de Vitest. |
| `sast-codeql` | Patrón nuevo detectado como vulnerable: por ejemplo, un `innerHTML` sin sanitizar o un fetch con URL dinámica. | Pestaña **Security → Code scanning alerts**. Cada alerta tiene un link al fragmento exacto. |
| `sca-audit` | Una dependencia recibió un CVE publicado entre la última ejecución verde y esta. | Logs del job → línea con el GHSA-ID. Esperar la PR de Dependabot o actualizar manualmente. |
| `dockerfile-lint` | Edición del [Dockerfile](../Dockerfile) que reintrodujo un antipatrón. | Logs del job → la regla DL3xxx señala la línea. |

3. **Cierra el ciclo** con un commit nuevo en la misma PR. El workflow re-ejecuta automáticamente.
4. Si necesitas correr el pipeline manualmente (sin push), usa `workflow_dispatch` desde la pestaña **Actions** → selecciona el workflow → **Run workflow**.

---

## 6. Referencias rápidas

- Definición del workflow: [.github/workflows/ci-security.yml](../.github/workflows/ci-security.yml)
- Config CodeQL: [.github/codeql/codeql-config.yml](../.github/codeql/codeql-config.yml)
- Config Dependabot: [.github/dependabot.yml](../.github/dependabot.yml)
- Config ESLint: [eslint.config.js](../eslint.config.js)
- Decisiones de seguridad ya presentes en el código: [SECURITY.md](./SECURITY.md)
- Etapas pendientes con Banmédica: [ROADMAP.md](./ROADMAP.md)
- OWASP Top 10 2021 (referencia externa): <https://owasp.org/Top10/>
