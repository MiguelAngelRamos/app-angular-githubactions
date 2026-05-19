# ════════════════════════════════════════════════════════════════
#  PATRÓN MULTI-STAGE (varias etapas)
#  ¿Para qué sirve?
#    - Etapa BUILD: necesitamos Node, pnpm y todo el código fuente
#      para compilar la app. Ese entorno pesa cientos de MB.
#    - Etapa SERVE: en producción solo necesitamos los archivos
#      estáticos (HTML/CSS/JS) servidos por Nginx (~25 MB).
#  Resultado: imagen final ~25 MB en vez de ~700 MB.
#  Beneficio extra de seguridad: menor superficie de ataque.
#  Sin Node ni node_modules en producción, las vulnerabilidades
#  conocidas (CVE) de esos paquetes no llegan al contenedor expuesto.
#  CVE = Common Vulnerabilities and Exposures (catálogo público
#  de vulnerabilidades de software).
# ════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════
#  STAGE 1 — BUILD (compilación)
#  Instala dependencias y compila la app Angular.
#  Esta etapa NO llega a la imagen final: código fuente, node_modules
#  y devDependencies (dependencias solo de desarrollo) son descartados
#  automáticamente por Docker tras el build.
# ════════════════════════════════════════════════════════════════
FROM node:22-alpine AS builder

# ── Habilitar pnpm via Corepack (como root) ───────────────────
# Corepack necesita escribir en /usr/local/bin/ para crear el
# symlink de pnpm. Ese directorio pertenece a root, así que este
# paso DEBE ejecutarse antes de cambiar a USER node.
# Es seguro: solo crea un symlink, no ejecuta código del proyecto.
# El paso peligroso (pnpm install, que sí corre scripts de
# paquetes) se ejecutará luego como usuario "node".
RUN corepack enable

# ── Seguridad: principio de mínimo privilegio ─────────────────
# NO ejecutamos comandos como root. Si una dependencia maliciosa
# o un script post-install se ejecutara durante el build, quedaría
# limitado al usuario "node" (sin privilegios), no podría tocar
# el sistema. "node" ya viene creado en la imagen oficial.
USER node

WORKDIR /home/node/app

# ── Optimización: aprovechar la caché de capas de Docker ──────
# Docker construye la imagen capa por capa y reutiliza capas
# previas si los archivos no cambiaron. Si copiamos primero SOLO
# los manifiestos (package.json + lockfile), la capa de "instalar
# dependencias" se reutiliza mientras esos archivos no cambien,
# aunque el código fuente sí cambie. Resultado: builds mucho más
# rápidos en desarrollo iterativo.
COPY --chown=node:node package.json pnpm-lock.yaml ./

# ── Instalar dependencias con pnpm ────────────────────────────
# Corepack ya fue habilitado arriba (como root), así que pnpm está
# disponible en /usr/local/bin/. Aquí solo instalamos.
#
# --frozen-lockfile: instala EXACTAMENTE las versiones del lockfile.
# Si el lockfile está desactualizado respecto a package.json, falla.
# Esto garantiza builds reproducibles: la misma imagen hoy y mañana.
RUN pnpm install --frozen-lockfile

# Ahora copiamos el resto del código fuente (lo que .dockerignore
# no excluya).
COPY --chown=node:node . .

# ── Compilar en modo producción ────────────────────────────────
# Aplica las siguientes optimizaciones:
#  - Tree-shaking: elimina código que no se usa (módulos, funciones).
#  - Minificación: reduce el tamaño del JS quitando espacios y
#    acortando nombres de variables internas.
#  - Cache busting con hashes: cada bundle lleva un hash en su nombre
#    (ej: main-A1B2C3D4.js). Si el contenido cambia, el hash cambia,
#    y el navegador descarga la nueva versión en vez de servir la
#    cacheada. Sin esto, los usuarios verían la versión vieja tras
#    un deploy hasta que limpiaran la caché.
#  - environment.prod.ts activo: configuración de producción
#    (sin logs de PII, sin endpoints de desarrollo, etc.).
#    PII = Personal Identifiable Information (datos personales
#    identificables: emails, DNIs, nombres, etc.).
RUN pnpm run build --configuration production


# ════════════════════════════════════════════════════════════════
#  STAGE 2 — SERVE (servir archivos estáticos)
#  Imagen final: solo Nginx + los archivos estáticos compilados.
#  No hay Node, no hay código fuente, no hay node_modules,
#  no hay devDependencies → menor tamaño, menor superficie de ataque.
# ════════════════════════════════════════════════════════════════
FROM nginx:1.27-alpine AS runner

# ── Seguridad: eliminar la configuración por defecto de Nginx ──
# El default.conf que viene con la imagen oficial:
#   - expone la versión exacta de Nginx en cabeceras HTTP
#     (información útil para que un atacante busque exploits).
#   - no incluye ninguna cabecera de seguridad moderna.
# Lo borramos y cargamos nuestra propia configuración endurecida.
RUN rm -f /etc/nginx/conf.d/default.conf

# ── Copiar el resultado del build desde la etapa anterior ──────
# --from=builder: trae archivos desde la etapa "builder", no del host.
# Solo copiamos el directorio /browser (output de Angular v17+ con
# la herramienta @angular/build:application). Nada más: ni package.json,
# ni código fuente, ni node_modules.
COPY --from=builder /home/node/app/dist/practic-example/browser /usr/share/nginx/html

# Configuración personalizada de Nginx (cabeceras de seguridad,
# cache, compresión, etc.).
COPY nginx.conf /etc/nginx/conf.d/app.conf

# ── Seguridad: ajustar permisos de archivos ────────────────────
# 555 = lectura + ejecución para todos, SIN permiso de escritura.
# Los archivos estáticos NO deben modificarse en runtime: si un
# atacante lograra ejecutar código dentro del contenedor, no podría
# reescribir el index.html para inyectar payloads (por ejemplo,
# scripts maliciosos que roben tokens de sesión).
# El proceso de Nginx (worker) necesita escribir en cache y logs.
# Damos permisos solo a esos directorios al usuario "nginx".
RUN chmod -R 555 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown nginx:nginx /etc/nginx/conf.d/app.conf

# ── Seguridad: ejecutar Nginx como usuario sin privilegios ─────
# Si Nginx fuese vulnerado y el atacante lograra ejecución de
# código, lo haría como "nginx" (sin acceso a archivos de sistema),
# no como root.
USER nginx

# ── Puerto no privilegiado ─────────────────────────────────────
# En Linux, los puertos < 1024 (incluido el 80 estándar de HTTP)
# requieren privilegios de root para escucharlos. Como queremos
# correr como usuario "nginx" (no root), usamos el 8080.
# En despliegue se mapea al puerto público:
#   docker run -p 80:8080 mi-imagen
EXPOSE 8080

# ── HEALTHCHECK ────────────────────────────────────────────────
# Docker comprueba periódicamente si el contenedor responde.
# Si falla 3 veces seguidas, lo marca como "unhealthy" y los
# orquestadores (Kubernetes, Docker Swarm) lo reinician o lo sacan
# del balanceador de carga.
#   --interval=30s    : repetir cada 30 segundos.
#   --timeout=5s      : si tarda más de 5s, falló.
#   --start-period=10s: ignora fallos durante los primeros 10s
#                       (tiempo de arranque de Nginx).
#   --retries=3       : 3 fallos consecutivos = unhealthy.
# wget viene incluido en BusyBox (suite de utilidades de Alpine
# Linux), por lo que está disponible sin instalar nada.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

# Arrancar Nginx en primer plano (foreground).
# Sin "daemon off", Nginx se demoniza (corre en segundo plano) y
# el proceso principal del contenedor termina inmediatamente,
# haciendo que Docker considere que el contenedor finalizó.
CMD ["nginx", "-g", "daemon off;"]
