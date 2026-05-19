# Decisiones de seguridad ya presentes en el código

> Material docente del curso **Desarrollo Seguro Avanzado** (Kibernum / Banmédica). Este documento **no describe** lo que hace el código (eso ya lo dice el código) — explica **por qué** está hecho así, qué ataque mitiga cada decisión y qué pasaría si se quitara. El objetivo es que el alumno entienda la racional antes de tocar nada.

Cada sección referencia archivos reales del proyecto. Si la implementación cambia, este documento debe actualizarse.

---

## 1. JWT con dual-token: access en memoria, refresh en cookie HttpOnly

Archivos clave:
- [src/app/core/auth/auth.service.ts](../src/app/core/auth/auth.service.ts)
- [src/app/core/auth/auth.interceptor.ts](../src/app/core/auth/auth.interceptor.ts)

### Qué hace el código

El **access token** vive solo en memoria, dentro de un `signal<string | null>` privado del `AuthService` ([auth.service.ts:14](../src/app/core/auth/auth.service.ts#L14)). Nunca toca `localStorage` ni `sessionStorage`.

El **refresh token** vive solo en una cookie marcada `HttpOnly`, `Secure`, `SameSite=Strict`, `path=/api/v1/auth/refresh`. El frontend nunca lo lee — solo `withCredentials: true` en las llamadas relevantes hace que el navegador la adjunte automáticamente ([auth.service.ts:53](../src/app/core/auth/auth.service.ts#L53)).

### Por qué — qué ataque mitiga cada decisión

**Access token en memoria, no en localStorage**
- Mitiga **XSS** (OWASP **A03**). Si una librería de terceros comprometida ejecutara `document.querySelector('script')` y filtrara `localStorage`, no encontraría el token: vive en una variable de un closure de Angular, no accesible desde `window`.
- Coste aceptado: cuando el usuario cierra la pestaña, el access token se pierde y la app llama a `/auth/refresh` al volver para reconstruirlo desde la cookie.

**Refresh token en cookie HttpOnly**
- `HttpOnly` impide que JavaScript la lea (`document.cookie` la oculta). Mitiga el robo por XSS.
- `Secure` impide que viaje sobre HTTP plano. Mitiga **MITM** (OWASP **A02 Cryptographic Failures**).
- `SameSite=Strict` impide que el navegador la adjunte en navegaciones cross-site. Mitiga **CSRF** (OWASP **A01 Broken Access Control**).
- `path=/api/v1/auth/refresh` reduce la superficie: el navegador solo la envía a ese endpoint, no a `/api/v1/citas` ni a ningún otro. Si el backend logueara cookies por error, el endpoint de citas no las vería.

### Qué pasaría si se quitara

- Guardar el access token en `localStorage`: cualquier XSS lo extrae en 1 línea (`localStorage.getItem('token')`) y el atacante usa la sesión hasta que expire.
- Cookie sin `HttpOnly`: el robo por XSS pasa a ser trivial (`document.cookie`).
- Sin `SameSite=Strict`: una página atacante embebida puede forzar al navegador a llamar a `/api/v1/auth/refresh` y obtener un access token válido.

---

## 2. SafeLogger con whitelist de campos

Archivo: [src/app/core/http/safe-logger.ts](../src/app/core/http/safe-logger.ts)

### Qué hace el código

`SafeLogger.error(scope, err)` extrae **solo** los campos `status`, `statusText`, `url` y `name` del objeto error antes de pasarlo a `console.error`. El resto se descarta ([safe-logger.ts:21](../src/app/core/http/safe-logger.ts#L21)). En `environment.production: false` deja pasar todo para facilitar debugging local.

### Por qué whitelist y no blacklist

Whitelist = "estos 4 campos son los únicos que se pueden loguear".
Blacklist = "estos 7 campos están prohibidos".

La whitelist es **fail-safe**: si en el futuro el backend NestJS añade un campo nuevo al body de error (por ejemplo `patientFullName` en una validación), una blacklist tendría que ser actualizada — si nadie se acuerda, se filtra PHI. La whitelist seguirá ignorando ese campo automáticamente porque no está en `SAFE_FIELDS`.

### Por qué importa: HIPAA §164.312(b)

El estándar **HIPAA §164.312(b)** (Audit controls) y **§164.312(c)(1)** (Integrity) obligan a evitar filtrar **Protected Health Information** (PHI) a logs no controlados. La consola del navegador es un canal lateral: cualquier extensión, sesión abierta de DevTools o herramienta corporativa de monitoreo puede capturarla.

El backend NestJS de la clínica puede devolver en errores de validación el cuerpo del paciente — nombre, fecha de nacimiento, número de historia clínica. Sin `SafeLogger`, una llamada a `console.error(error)` desde [error.interceptor.ts](../src/app/core/http/error.interceptor.ts) volcaría esa información en bruto.

### Qué pasaría si se quitara

Un `console.error(error)` directo serializa el `HttpErrorResponse` completo, incluyendo `error.error` que es el body literal del backend. En un error 422 de validación, eso significa volcar los datos del paciente que provocó el rechazo en la consola.

---

## 3. Guards en cascada: authGuard → rolesGuard → roleRedirectGuard

Archivos:
- [src/app/core/auth/auth.guard.ts](../src/app/core/auth/auth.guard.ts)
- [src/app/core/auth/roles.guard.ts](../src/app/core/auth/roles.guard.ts)
- [src/app/app.routes.ts](../src/app/app.routes.ts)

### Qué hace el código

Las rutas `/admin` y `/patient` declaran:
```ts
canActivate: [authGuard, rolesGuard(['admin'])],
canMatch:    [authGuard, rolesGuard(['admin'])],
```

Angular ejecuta los guards **en orden**: primero `authGuard` (¿hay sesión?), luego `rolesGuard(['admin'])` (¿el rol coincide?). Si el primero devuelve `false`, el segundo no se evalúa.

### Por qué `authGuard` primero

`rolesGuard` lee `authService.userRole()`, que depende de `currentUser()`, que es `null` cuando no hay sesión. Si `rolesGuard` corriera primero sobre una sesión inexistente, redirigiría a `/403` ("estás logueado pero te falta permiso") cuando en realidad el problema es que **no estás logueado** → debería ir a `/login`.

El orden no es decorativo: define la UX correcta y evita logs falsos de "acceso denegado" que confundirían en auditorías.

### Por qué `canMatch` además de `canActivate`

- `canActivate` evalúa el guard **después** de descargar el chunk lazy del módulo. Si el chunk es de `/admin` y el usuario es `patient`, el patient acaba descargando el código del área admin sin poder verlo — código que aparece en su Network tab y que un usuario malicioso puede inspeccionar para entender la lógica interna.
- `canMatch` evalúa el guard **antes** de descargar el chunk. Si el rol no calza, el módulo no se descarga jamás.

Beneficios:
1. **Defensa por ofuscación**: un patient nunca ve los componentes admin en su bundle.
2. **Ahorro de tráfico**: cero peticiones inútiles al servidor de assets.
3. **OWASP A01 Broken Access Control** mejor cubierto: la frontera real sigue siendo el backend, pero el frontend deja de filtrar señales sobre qué rutas existen.

### Qué pasaría si se quitara `canMatch`

Funcionalmente el área seguiría protegida (gracias a `canActivate`), pero el alumno con DevTools abierto vería bajar `chunk-admin.XXXX.js` cuando navega a `/admin/dashboard` siendo `patient` — y al inspeccionar el bundle podría leer el código de los componentes, descubrir nombres de endpoints internos, etc.

---

## 4. Refresh gate con `BehaviorSubject` (un solo refresh en vuelo)

Archivos:
- [src/app/core/auth/auth.service.ts](../src/app/core/auth/auth.service.ts) (líneas 22, 50-63)
- [src/app/core/auth/auth.interceptor.ts](../src/app/core/auth/auth.interceptor.ts) (líneas 19-25, 46-62)

### Qué hace el código

El `AuthService` expone un `BehaviorSubject<boolean>` privado llamado `_isRefreshing$`. Cuando una petición recibe `401` y se inicia el refresh:

1. `_isRefreshing$.next(true)` abre el gate.
2. El `Observable` del refresh se cachea en `refreshRequest$` con `shareReplay({ bufferSize: 1, refCount: true })`.
3. Cualquier otra petición concurrente que entre al interceptor:
   - Si NO es un endpoint `/auth/*` y el gate está abierto → se suspende esperando `_isRefreshing$ === false` ([auth.interceptor.ts:19-25](../src/app/core/auth/auth.interceptor.ts#L19-L25)).
   - Cuando el refresh termina, se reintenta con el token nuevo.
4. `_isRefreshing$.next(false)` cierra el gate en `finalize`.

### Por qué un solo refresh en vuelo

Sin el gate, una escena con 3 peticiones concurrentes que reciben 401 simultáneamente dispararía 3 `POST /auth/refresh` independientes.

El backend NestJS implementa **reuse detection**: cada refresh válido **rota** el token y guarda el hash del nuevo en DB. Cuando el segundo `POST /auth/refresh` llega con el mismo refresh viejo, el hash ya no matchea → el backend interpreta esto como **token reuse** (un atacante intentando reusar un refresh ya consumido) y **revoca la familia completa** (`refreshTokenHash = null` en DB).

Resultado sin gate: una carga concurrente legítima dispara la revocación de la propia sesión del usuario. El usuario es deslogueado por una "amenaza" inexistente.

### Por qué `BehaviorSubject` y no `Subject`

`BehaviorSubject` emite el valor actual al suscribirse. Si una petición B llega cuando el gate ya está en `true`, se suscribe a `isRefreshing$` y recibe inmediatamente `true` → entra al `filter(refreshing => !refreshing)` que espera. Con un `Subject` plano se perdería esa emisión inicial y la petición B saldría con el token viejo.

### Qué pasaría si se quitara

Bajo carga concurrente real (3+ requests con tokens expirados al mismo tiempo), el usuario sería desconectado al recargar una página con muchas peticiones paralelas — comportamiento intermitente y casi imposible de debuggear en producción.

---

## 5. nginx.conf: cabeceras de seguridad, CSP y patrones de cache

Archivo: [nginx.conf](../nginx.conf)

### Cabeceras de seguridad

| Cabecera | Valor | Qué bloquea |
|---|---|---|
| `server_tokens off` | — | Oculta la versión exacta de nginx para que un atacante no busque exploits específicos. |
| `X-Frame-Options: DENY` | DENY | **Clickjacking**: ningún sitio puede embeber esta app en un `<iframe>`. |
| `X-Content-Type-Options: nosniff` | nosniff | **MIME sniffing**: navegadores antiguos podrían interpretar un `.txt` como HTML; este header lo prohíbe. |
| `Referrer-Policy: strict-origin-when-cross-origin` | — | Evita filtrar la URL completa (con posibles IDs sensibles) al navegar a otro dominio. |
| `Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` | — | Deshabilita APIs del navegador que la app no usa: si un dependency comprometido pide la cámara, el navegador la bloquea aunque el código lo intente. |
| `Content-Security-Policy: default-src 'self'; script-src 'self'; ...` | — | **XSS** (OWASP A03): el navegador solo ejecuta scripts servidos desde el mismo origen, bloqueando inline scripts inyectados. |
| `Strict-Transport-Security` | — | Comentado por defecto: activarlo en producción tras confirmar TLS estable. Una vez activado, el navegador rechaza `http://` para este dominio durante `max-age`. |

### Qué permite y qué bloquea la CSP actual

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

- **Permite**: scripts y conexiones solo al propio dominio, imágenes/fuentes inline (data: URIs), estilos inline (necesario porque Angular inyecta estilos por componente en el `<head>`).
- **Bloquea**: scripts inline (`<script>alert(1)</script>` en el DOM no se ejecuta), scripts de CDN externo, llamadas fetch a otros dominios, embed en iframes externos, `<base href>` malicioso, envío de forms a otro origen.
- **Coste de `unsafe-inline` en `style-src`**: Angular sin SSR no tiene forma de añadir un nonce a sus estilos por componente. Si en el futuro se migra a SSR o se usa CSP nonces dinámicas, eliminar `unsafe-inline`.

### Por qué `expires` en lugar de `add_header` en los locations de cache

Detalle técnico crucial de nginx:
> Si un `location` declara un `add_header`, nginx deja de heredar los `add_header` del `server` que lo contiene.

Las locations de cache (`location = /index.html`, `location ~* "-[0-9a-f]{8,}\.(?:js|css|woff2?)$"`) usan `expires` para controlar `Cache-Control` **sin** reemplazar las cabeceras de seguridad heredadas. Si se hubiera usado `add_header Cache-Control ...`, esos archivos se servirían **sin** CSP ni X-Frame-Options ni Permissions-Policy — una regresión silenciosa de seguridad que es muy fácil cometer y muy difícil detectar (los headers desaparecen solo en bundles, no en el HTML).

### Bloqueo de archivos sensibles

```
location ~* \.(?:env|map|lock|md|sh|ts|conf|log)$ { deny all; return 404; }
location ~ /\.                                    { deny all; return 404; }
```

Defensa en profundidad: el `COPY` del [Dockerfile](../Dockerfile) solo trae `dist/.../browser`, pero si por error futuro alguien añadiera otros archivos al `COPY`, nginx no los serviría. `.env` (secretos), `.map` (source maps que revelan código TS original), `.git/` (historial completo), `.htaccess` (config oculta) — todos cerrados.

---

## 6. Dockerfile: multi-stage, USER non-root, puerto 8080, chmod 555

Archivo: [Dockerfile](../Dockerfile)

### Multi-stage (BUILD + RUNTIME)

- **Stage 1 `builder`** (`node:22-alpine`): Node, pnpm, todo el código fuente, devDependencies. Compila la app. Pesa ~700 MB.
- **Stage 2 `runner`** (`nginx:1.27-alpine`): solo nginx + los HTML/CSS/JS estáticos. Pesa ~25 MB.

Por qué importa:
1. **Superficie de ataque**: la imagen final no tiene Node, ni pnpm, ni node_modules. Las CVEs de esos paquetes (que aparecen constantemente) no llegan al contenedor expuesto.
2. **Confidencialidad del código**: el source TS, `package.json`, lockfile y devDependencies se quedan en la stage `builder` y nunca llegan al registry. Un atacante con acceso a la imagen final no puede leer el código fuente original ni la lista de dependencias internas.

### USER non-root (`node` en build, `nginx` en runtime)

- En **build**: si una dependencia maliciosa ejecutara un script postinstall (ataque conocido como `event-stream` 2018), quedaría limitado al usuario `node`. No puede instalar binarios en `/usr/local/bin`, no puede modificar `/etc/`.
- En **runtime**: si nginx tiene una RCE futura (CVE), el atacante hereda permisos de `nginx`, no de `root`. No puede modificar archivos del sistema ni montar volúmenes.

Mitiga **OWASP A05 Misconfiguration** y reduce el blast radius de cualquier vuln futura en la cadena.

### Puerto 8080 (no 80)

En Linux, los puertos < 1024 requieren capability `CAP_NET_BIND_SERVICE` o root. Para correr como usuario `nginx` (no root), elegimos 8080. El mapeo externo se hace en el `docker run -p 80:8080` o en el manifest de Kubernetes.

Sin esta decisión, tendríamos que correr como root (riesgo enorme) o añadir capabilities (complejidad y superficie extra).

### `chmod 555` en `/usr/share/nginx/html`

- `555` = lectura + ejecución para todos, **sin escritura**.
- Los archivos estáticos no deben modificarse en runtime. Si un atacante lograra ejecución de código dentro del contenedor (vía una RCE de nginx, por ejemplo), **no podría reescribir el `index.html` para inyectar un script que robe tokens**.
- nginx sí necesita escribir en `/var/cache/nginx` y `/var/log/nginx` — solo a esos directorios damos `chown nginx:nginx`. Mínimo privilegio aplicado.

### HEALTHCHECK con wget

`wget -qO- http://localhost:8080/` cada 30s. Si nginx deja de responder, Docker/K8s lo marca como `unhealthy` y lo reinicia o lo saca del load balancer. Sin este check, una app caída sigue recibiendo tráfico hasta que un humano lo nota.

---

## 7. Resumen de mapeo OWASP Top 10 2021

| Decisión | OWASP |
|---|---|
| Access token en memoria, refresh en cookie HttpOnly/Secure/SameSite | A01, A02, A03, A07 |
| SafeLogger con whitelist | A09 (Security Logging Failures), HIPAA §164.312 |
| Guards en cascada + `canMatch` | A01 |
| Refresh gate con BehaviorSubject | A07 |
| Cabeceras de seguridad y CSP en nginx | A03, A05 |
| `expires` en lugar de `add_header` en locations | A05 |
| Dockerfile multi-stage + USER non-root + 555 | A05, A06 |
| Bloqueo de `.env`, `.map`, `.ts`, archivos ocultos en nginx | A02, A05 |

Toda esta inversión es lo que el pipeline ([PIPELINE.md](./PIPELINE.md)) protege contra regresiones futuras.
