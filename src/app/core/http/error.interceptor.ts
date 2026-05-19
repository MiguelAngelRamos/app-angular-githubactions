import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SafeLogger } from './safe-logger';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  //* H-06: usamos SafeLogger en lugar de console.error directo. Garantiza que
  //* en producción nunca se serialicen cuerpos de error que puedan contener
  //* PHI devuelta por el backend (ej. nombre/fecha de nacimiento del paciente
  //* en mensajes de validación).
  const logger = inject(SafeLogger);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403) {
        router.navigate(['/403']);
      }
      if (error.status === 0) {
        //* H-06: mensaje genérico, sin info de la URL exacta — un atacante
        //* observando la consola no debería ver la topología interna.
        logger.warn('http', 'Error de red: no se pudo conectar con el servidor');
      }
      //* H-06: log estructurado con meta seguro únicamente. SafeLogger filtra
      //* error.error / error.message en producción.
      if (error.status >= 500) {
        logger.error('http', error);
      }
      return throwError(() => error);
    }),
  );
};
