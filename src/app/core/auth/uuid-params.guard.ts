import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

//* H-01: Regex UUID v4 estricto. Acepta solo el formato canónico:
//*   xxxxxxxx-xxxx-4xxx-[8|9|a|b]xxx-xxxxxxxxxxxx
//* La versión (4) y la variante ([89ab]) están bloqueadas por la spec — un
//* string que no las cumple NO es un UUID v4 y no debería llegar al backend.
//* Al validar antes del fetch evitamos:
//*   1) Tráfico inválido contra NestJS que ensucia logs y rate limiters.
//*   2) Enumeración por timing entre 400 (no-UUID), 404 (UUID inexistente) y
//*      200/401/403 (UUID real).
//*   3) Renderizado innecesario del componente con su loading state, que filtra
//*      métricas RUM de rutas que no debieron ejecutarse.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

//* H-01: factory que recibe el nombre del param de ruta a validar (por defecto 'id').
//* Componer con rolesGuard / authGuard manteniendo un orden explícito en
//* canActivate: [authGuard, uuidParamsGuard()] — primero autenticación, luego
//* validación de inputs.
export const uuidParamsGuard = (paramName: string = 'id'): CanActivateFn => (route) => {
  const router = inject(Router);
  const value = route.paramMap.get(paramName);

  //* H-01: si el param no existe consideramos válido — la ruta puede haber sido
  //* configurada sin :id (caso "new"). El responsable de exigir el param es el
  //* matcher de la ruta, no este guard.
  if (value === null) return true;

  if (UUID_V4.test(value)) return true;

  //* H-01: redirigimos a /404 con skipLocationChange:true para no dejar la ruta
  //* malformada en el historial del navegador (de lo contrario el botón "atrás"
  //* repetiría el ataque y el usuario no podría salir fácilmente).
  router.navigate(['/404'], { skipLocationChange: true });
  return false;
};
