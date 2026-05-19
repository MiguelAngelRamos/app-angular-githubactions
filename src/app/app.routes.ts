import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { rolesGuard } from './core/auth/roles.guard';
import { roleRedirectGuard } from './core/auth/role-redirect.guard';

//* Estructura de rutas raíz. Cada bloque comenta QUÉ guards lo protegen,
//* POR QUÉ y en qué orden se ejecutan.
//*
//* Convenciones aplicadas:
//*   - Lazy loading (loadChildren) por área para que el bundle inicial
//*     contenga solo login + páginas de error. El módulo admin/patient
//*     se descarga la PRIMERA vez que el usuario navega a su sección.
//*   - Composición de guards en `canActivate`: Angular los ejecuta en orden.
//*     authGuard SIEMPRE primero (si no, los demás guards trabajarían sobre
//*     un signal `currentUser` posiblemente nulo).
export const routes: Routes = [
  //* Redirección raíz — preferimos `/login` como entrada por defecto. Si el
  //* usuario ya tiene sesión, su próximo intento de cargar / pasará por
  //* /login y podríamos enviarlo automáticamente al dashboard (mejora futura).
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },

  //* Rutas públicas de autenticación. NO llevan authGuard a propósito —
  //* un usuario no autenticado tiene que poder llegar al login.
  //* (Mejora opcional: añadir un guard inverso "publicOnly" que redirija
  //* a /dashboard si ya hay sesión, para evitar que un usuario logueado
  //* vea el formulario de login. Lo dejo fuera por simplicidad inicial.)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(module => module.LoginComponent),
    title: 'Iniciar sesión · Clínica',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        module => module.RegisterComponent,
      ),
    title: 'Crear cuenta · Clínica',
  },

  //* Punto de entrada post-login. authGuard verifica que hay sesión
  //* (refresca con cookie HttpOnly si el access token expiró) y luego
  //* roleRedirectGuard devuelve un UrlTree apuntando a /admin/dashboard
  //* o /patient/dashboard según el rol. Sin componente intermedio:
  //* el router cancela la activación y navega directamente al destino.
  {
    path: 'dashboard',
    canActivate: [authGuard, roleRedirectGuard],
    //* `children: []` evita que Angular se queje por "ruta sin componente"
    //* — el guard siempre devuelve UrlTree así que esta lista no se usa.
    children: [],
  },

  //* Área de administración. Doble protección:
  //*   1) authGuard — exige sesión válida.
  //*   2) rolesGuard(['admin']) — exige que el rol del JWT sea 'admin'.
  //*      El backend ya filtra con su RolesGuard; aquí prevenimos
  //*      parpadeos visuales y reducimos tráfico inútil (ver roles.guard.ts).
  {
    path: 'admin',
    canActivate: [authGuard, rolesGuard(['admin'])],
    //* `canMatch` hace que Angular ni siquiera DESCARGUE el chunk del módulo
    //* admin si el usuario no es admin. Mejora seguridad por ofuscación
    //* (un patient nunca verá el código del área admin en su Network tab) y
    //* además evita un viaje innecesario al servidor de assets.
    canMatch: [authGuard, rolesGuard(['admin'])],
    loadChildren: () =>
      import('./features/admin/admin.routes').then(module => module.adminRoutes),
  },

  //* Área del paciente. Misma estructura que /admin pero rolesGuard(['patient']).
  {
    path: 'patient',
    canActivate: [authGuard, rolesGuard(['patient'])],
    canMatch: [authGuard, rolesGuard(['patient'])],
    loadChildren: () =>
      import('./features/patient/patient.routes').then(module => module.patientRoutes),
  },

  //* Páginas de error. SIN guards — un usuario no autenticado también puede
  //* aterrizar aquí (ej. el errorInterceptor redirige a /403 ante un 403 HTTP
  //* aunque la sesión haya expirado en mitad de una operación).
  {
    path: '403',
    loadComponent: () =>
      import('./shared/error-pages/forbidden/forbidden.component').then(
        module => module.ForbiddenComponent,
      ),
    title: 'Acceso denegado · Clínica',
  },
  {
    path: '404',
    loadComponent: () =>
      import('./shared/error-pages/not-found/not-found.component').then(
        module => module.NotFoundComponent,
      ),
    title: 'Página no encontrada · Clínica',
  },

  //* Wildcard al final — cualquier ruta no resuelta cae aquí. Reusamos el
  //* mismo componente que '/404' para que la experiencia sea consistente.
  {
    path: '**',
    loadComponent: () =>
      import('./shared/error-pages/not-found/not-found.component').then(
        module => module.NotFoundComponent,
      ),
    title: 'Página no encontrada · Clínica',
  },
];
