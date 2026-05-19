import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

//* Guard de redirección por rol — se monta en la ruta `/dashboard` para que,
//* tras el login, el usuario aterrice automáticamente en el área que le
//* corresponde sin tener que conocer las URLs internas.
//*
//* Por qué un guard y no un componente "DashboardRedirect":
//*   - Un componente intermedio renderizaría un instante (incluso un blank
//*     frame) antes de navegar, lo que se ve como un parpadeo.
//*   - Devolver un UrlTree desde un guard hace que el router cancele la
//*     activación y navegue directamente a la URL final — sin componente
//*     intermedio, sin parpadeo, sin entrada extra en el historial.
//*
//* Este guard SIEMPRE corre DESPUÉS de authGuard. authGuard garantiza que
//* `currentUser()` ya está en memoria (con refresh si era necesario), así
//* que aquí la lectura del rol es síncrona.
export const roleRedirectGuard: CanActivateFn = (): UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentRole = authService.userRole();

  switch (currentRole) {
    case 'admin':
      return router.parseUrl('/admin/dashboard');
    case 'patient':
      return router.parseUrl('/patient/dashboard');
    case 'doctor':
      //* El doctor existe en el modelo del backend pero su área aún no está
      //* implementada en este frontend. Lo enviamos a /403 hasta que se
      //* construya `/doctor/**` — preferible a una ruta rota.
      return router.parseUrl('/403');
    default:
      //* Caso defensivo: authGuard ya debería haber bloqueado esto, pero si
      //* algo se cuela (rol desconocido en el JWT, sesión corrupta), mejor
      //* limpiar y mandar a login que dejar al usuario en una pantalla en blanco.
      authService.clearSessionAndRedirect();
      return router.parseUrl('/login');
  }
};
