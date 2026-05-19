import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '../models/auth.models';

//* OWASP A01 (Broken Access Control) — Defensa en profundidad.
//* El backend ya aplica RBAC con su propio RolesGuard sobre los endpoints
//* (@Roles(UserRole.ADMIN), etc.) — un atacante con rol "patient" recibe
//* 403 aunque manipule la URL. Aún así, este guard del frontend tiene dos
//* propósitos legítimos:
//*
//*   1) UX: redirige al usuario a /403 ANTES de hacer la petición,
//*      evitando un parpadeo donde se renderiza media pantalla y luego
//*      desaparece tras el 403.
//*   2) Reduce tráfico inútil: si un usuario navega manualmente a
//*      /admin/dashboard estando logueado como paciente, no llega ni
//*      una sola petición al backend — ahorra logs, rate-limiter y
//*      coste de cómputo.
//*
//* IMPORTANTE: este guard NO es la frontera de seguridad. La frontera real
//* está en el backend. Aquí solo aportamos comodidad y defensa en profundidad.
//* Por eso aceptamos tipar `allowedRoles` como un array y no encriptarlo —
//* un atacante puede leer este código en el bundle, pero no puede saltarse
//* el RolesGuard del NestJS.
export const rolesGuard = (allowedRoles: readonly UserRole[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentRole = authService.userRole();

  //* Si no hay rol en memoria, el authGuard previo se encargará de
  //* refrescar o redirigir a /login. Aquí tratamos ese caso como
  //* "no autorizado" para esta ruta y mandamos a /login — nunca a /403,
  //* porque /403 es para "estás logueado pero te falta permiso".
  if (currentRole === null) {
    router.navigate(['/login']);
    return false;
  }

  if (allowedRoles.includes(currentRole)) return true;

  //* skipLocationChange: la URL actual sigue siendo /admin/... mientras
  //* mostramos el 403. Si dejáramos cambiar la URL a /403, el botón "atrás"
  //* del navegador devolvería al usuario a la ruta prohibida y volvería a
  //* dispararse el guard — bucle visualmente incómodo.
  router.navigate(['/403'], { skipLocationChange: true });
  return false;
};
