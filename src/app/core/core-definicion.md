En Angular con standalone components y la estructura moderna, `core/` contiene todo lo que es **singleton y de infraestructura transversal** — cosas que se instancian una sola vez y que cualquier feature puede necesitar.

Concretamente:

**Guards** — protegen rutas, se registran en el router una sola vez.

**Interceptors** — modifican todas las peticiones HTTP globalmente (adjuntar token, manejar errores, rotar refresh).

**Services de infraestructura** — `auth.service.ts`, `session.service.ts`. No servicios de features (esos van dentro de su feature).

**Models/interfaces globales** — tipos que se usan en más de una feature: `User`, `ApiResponse`, `AppointmentSummary`, etc. Si un modelo solo lo usa una feature, va dentro de esa feature.

**`core.providers.ts`** — donde registras `provideHttpClient`, los interceptors, y cualquier configuración global que no va en `app.config.ts` directamente.

---

Lo que **no va** en `core/`:

- Componentes reutilizables → `shared/`
- Servicios que solo llaman a un endpoint específico → dentro de su feature
- Pipes, directivas → `shared/`
- Modelos exclusivos de una feature → dentro de esa feature

La regla práctica es: si lo eliminas de `core/` y una sola feature se rompe, probablemente no pertenece ahí. Si se rompe toda la app, sí pertenece.
