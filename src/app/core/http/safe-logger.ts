import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

//* H-06: Logger seguro frente a PHI/PII.
//* Reglas:
//*   - En producción NUNCA serializa cuerpos de error (error.error) ni payloads.
//*     Solo conserva metadatos no sensibles: status, url canónica, timestamp,
//*     code semántico (si lo da el backend).
//*   - En desarrollo deja pasar todo para facilitar debugging.
//*
//* Motivo: el backend NestJS puede devolver en errores de validación el cuerpo
//* del paciente (nombre, fecha de nacimiento, dirección, número de historia).
//* Si hacemos console.error(error) cualquier extensión del navegador o sesión
//* abierta de DevTools captura PHI — incumplimiento HIPAA §164.312.
@Injectable({ providedIn: 'root' })
export class SafeLogger {
  //* H-06: lista blanca de campos seguros que se pueden loguear en producción.
  //* Cualquier otra propiedad del error se descarta. Si en el futuro se añade
  //* un nuevo campo metadato (ej. requestId) hay que añadirlo aquí
  //* explícitamente — la lista corta es la garantía de seguridad.
  private static readonly SAFE_FIELDS = ['status', 'statusText', 'url', 'name'] as const;

  error(scope: string, err: unknown): void {
    if (environment.production) {
      //* H-06: en producción solo el meta-payload, sin posibles PHI.
      console.error(`[${scope}]`, this.sanitize(err));
    } else {
      //* H-06: en desarrollo conservamos el error completo para poder depurar.
      //* Los devs no deben tener PHI en sus seeds; si lo tienen, es un bug
      //* de los datos, no del logger.
      console.error(`[${scope}]`, err);
    }
  }

  warn(scope: string, message: string): void {
    //* H-06: warn solo acepta string fijo — no acepta payloads. Si necesitas
    //* loguear un valor variable usa error() con un objeto que pase por sanitize.
    console.warn(`[${scope}] ${message}`);
  }

  //* H-06: extrae solo los campos de la whitelist. Cualquier objeto recibido
  //* (HttpErrorResponse, Error, plain object) pasa por aquí — propiedades como
  //* .error, .body, .data o .message (que pueden contener PHI del backend) NO
  //* se incluyen porque no están en SAFE_FIELDS.
  private sanitize(err: unknown): Record<string, unknown> {
    if (err === null || typeof err !== 'object') return { value: '[non-object error]' };
    const source = err as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of SafeLogger.SAFE_FIELDS) {
      if (key in source) out[key] = source[key];
    }
    return out;
  }
}
