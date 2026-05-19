# Roadmap DevSecOps · Etapas pendientes

> Curso **Desarrollo Seguro Avanzado** · Kibernum / Banmédica · Minuta del 26 de marzo de 2026.

Este documento lista todo lo que **no** está en el pipeline actual ([PIPELINE.md](./PIPELINE.md)), por qué no está, y qué se necesita para activarlo. Cada fila está bloqueada por una validación pendiente con un interlocutor concreto de Banmédica.

---

## Estado por etapa

| # | Etapa | Herramienta propuesta | Estado | Bloqueador | Interlocutor Banmédica |
|---|---|---|---|---|---|
| 1 | **DAST** (Dynamic Application Security Testing) | **Bright** | Pendiente provisión | Banmédica está evaluando licencias y SSO con el IdP corporativo. Hasta que el escáner esté disponible, los huecos de runtime quedan sin cubrir (errores en vivo, CSP rota, race conditions, vulnerabilidades de lógica). | Equipo de seguridad — referencia: minuta del 26-mar-2026, punto 4.2 |
| 2 | **SBOM** (Software Bill of Materials) | **Syft** (formato CycloneDX) | Pendiente listado | El listado de herramientas autorizadas no incluye aún Syft. Sin SBOM no podemos responder consultas tipo "¿qué versión de bootstrap viajó en el deploy de marzo?" a posteriori. | Bárbara (Compliance) — envío de listado actualizado pendiente |
| 3 | **Escaneo de la imagen Docker** | **Grype** (Trivy bloqueado en Banmédica) | Pendiente listado | Trivy está explícitamente bloqueado por política interna; Grype es el reemplazo técnico equivalente pero aún no aparece en el listado de herramientas autorizadas. Sin esto, una CVE en la imagen base `nginx:1.27-alpine` no se detecta hasta la siguiente actualización manual del tag. | Bárbara (Compliance) |
| 4 | **Firma de la imagen** | **Cosign** (keyless OIDC vía GitHub Actions) | Pendiente listado | Cosign keyless aprovecha la identidad OIDC del runner para firmar sin gestionar llaves. Banmédica está validando si el modelo OIDC sin llaves cumple con su política de gestión de secretos. Sin firma, una imagen tirada por un atacante que comprometa el registry podría pasar como legítima. | Bárbara (Compliance) + equipo de seguridad |
| 5 | **Deploy a Kubernetes** | Manifests + `kubectl apply` o ArgoCD | Pendiente confirmación de Sandbox | El Sandbox corporativo de Banmédica donde correrán las demos del curso no está confirmado: namespace, cuotas, ingress, secrets storage. Hasta entonces el pipeline termina al publicar la imagen en `ghcr.io`. | Guillermo (Plataforma) — confirmación del Sandbox |

---

## Cómo se activará cada etapa cuando se desbloquee

### 1. DAST con Bright

Cuando la cuenta esté provisionada:
1. Añadir un job `dast-bright` después de `push-to-ghcr` (o en un workflow separado disparado tras el deploy).
2. El job levantará el contenedor publicado en un namespace de staging y apuntará Bright al endpoint expuesto.
3. Reglas mínimas a configurar: cobertura de OWASP Top 10 2021, profundidad de crawl autenticado (login con cuenta de prueba), exclusión de endpoints destructivos.
4. Gate: bloquear pipeline ante hallazgos `critical` o `high` confirmados (Bright reduce falsos positivos con replay automático).

### 2. SBOM con Syft

Cuando Syft entre en el listado:
1. Añadir step `anchore/sbom-action` al final del job `push-to-ghcr`.
2. Generar SBOM CycloneDX a partir de la imagen recién publicada (escanea capas, no solo `package.json`).
3. Adjuntar el SBOM como artifact (retención 30 días) y subirlo a Releases para auditoría.

### 3. Escaneo de imagen con Grype

Cuando Grype entre en el listado:
1. Añadir step `anchore/scan-action` entre `docker-build` y `push-to-ghcr`.
2. Gate: bloquear push si hay vulnerabilidades `high`/`critical` con fix disponible.
3. Configurar `severity-cutoff: high` y `fail-build: true`.
4. El SBOM del punto 2 alimenta a Grype, evitando rescanear capas.

### 4. Firma de imagen con Cosign keyless

Cuando Cosign keyless se apruebe:
1. Añadir step `sigstore/cosign-installer` en el job `push-to-ghcr`.
2. Después del push, ejecutar `cosign sign --yes ghcr.io/<owner>/<repo>@<digest>`.
3. La firma queda en el registry junto a la imagen (mismo manifest).
4. En el cluster, configurar el admission controller (Kyverno o Connaisseur) para rechazar imágenes sin firma válida emitida por el workflow autorizado.

### 5. Deploy a Kubernetes

Cuando el Sandbox esté listo:
1. Crear manifests `Deployment`, `Service`, `Ingress`, `NetworkPolicy` con securityContext non-root, readOnlyRootFilesystem, drop ALL capabilities.
2. Configurar secrets via External Secrets Operator hacia el vault corporativo.
3. Añadir job `deploy-staging` (push a main → staging) y `deploy-prod` (tag → prod con approval manual).
4. Integrar con ArgoCD si Banmédica ya tiene la plataforma de GitOps montada.

---

## Cobertura actual vs cobertura objetivo

Esta tabla resume qué riesgos cubre el pipeline hoy y cuáles cubrirá cuando todas las etapas estén activas. Sirve para reportar progreso a Banmédica.

| Riesgo / OWASP | Hoy | Tras Roadmap completo |
|---|---|---|
| Patrones inseguros en código TS/HTML (A03, A07, A08) | CodeQL `security-extended` | CodeQL + Bright (runtime confirmation) |
| CVEs en dependencias (A06) | Dependabot + `pnpm audit` | + Grype sobre la imagen final |
| Antipatrones del Dockerfile (A05) | Hadolint | Hadolint + Grype (CVE de la imagen) |
| Secretos en commits (A02, A07) | Secret Scanning + Push Protection | igual |
| Race conditions, errores de runtime | — | Bright DAST |
| Headers de respuesta reales del servidor (A05) | — | Bright DAST |
| Vulnerabilidades de lógica de negocio (A04) | — | Bright DAST + tests E2E |
| Trazabilidad imagen → commit → SBOM | Labels OCI básicos | + SBOM CycloneDX |
| Integridad de la imagen en el registry (A08) | — | Cosign keyless |
| Defensa en runtime del clúster (A05) | — | NetworkPolicy + admission controller |

---

## Iteraciones siguientes (no bloqueantes, pero recomendadas)

Aunque no están en el listado oficial, conviene plantearlas a Banmédica como mejoras pedagógicas:

- **Tests E2E con Playwright**: cubre el hueco "race condition real del refresh token" y "CSP rota en runtime" que ni SAST ni DAST detectan completamente. Coste bajo y aporta cobertura funcional al curso.
- **Aumentar cobertura de tests unitarios**: hoy solo existe [src/app/app.spec.ts](../src/app/app.spec.ts). Escribir specs por feature (auth, doctor, patient) permite activar gate de cobertura mínima (ej. 60%) en una iteración futura.
- **`renovate.json` complementando Dependabot**: permite agrupar actualizaciones (todas las @angular/* en una sola PR) reduciendo ruido. Solo si Banmédica autoriza herramientas adicionales.

---

## Comunicación con Banmédica

- Cada vez que se desbloquee una etapa, actualizar este documento y abrir PR con el nuevo step en [.github/workflows/ci-security.yml](../.github/workflows/ci-security.yml).
- Notificar al interlocutor responsable (columna **Interlocutor Banmédica**) antes de mergear cambios que afecten la matriz de cobertura.
- El pipeline actual está congelado a las herramientas autorizadas — cualquier inclusión adicional requiere aprobación previa documentada.
