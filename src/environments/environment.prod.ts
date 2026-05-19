//* OWASP A05 (Security Misconfiguration) — fichero de entorno para PRODUCCIÓN.
//* `production: true` activa la rama "log seguro" de SafeLogger: solo se
//* registran metadatos en la whitelist (status, statusText, url, name) y
//* nunca el cuerpo del error. Esto previene que PHI/PII (nombre del paciente,
//* fecha de nacimiento, etc.) llegue a DevTools, extensiones del navegador o
//* logs externos — requisito HIPAA §164.312.
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
};
