//* OWASP A05 (Security Misconfiguration) — fichero de entorno para DESARROLLO.
//* Lo importa SafeLogger para decidir si serializa el cuerpo completo del
//* error (dev) o solo metadatos seguros (prod). En desarrollo dejamos
//* `production: false` para que los devs vean el error completo en consola
//* y puedan depurar; en prod este flag debe quedar en `true` para evitar
//* filtrar PHI/PII devuelta por el backend en errores de validación.
export const environment = {
  production: false,
  //* `apiBaseUrl` se usa como prefijo en todas las llamadas HTTP. El valor
  //* coincide con el `setGlobalPrefix('api/v1')` del backend NestJS. Si en el
  //* futuro se versiona la API a v2 basta con cambiarlo aquí en un solo sitio.
  apiBaseUrl: '/api/v1',
};
