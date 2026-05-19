import { Routes } from '@angular/router';

//* Rutas del área de administración. Se cargan via lazy loading desde
//* app.routes.ts. La protección (authGuard + rolesGuard(['admin'])) se
//* aplica en la ruta padre `/admin` de app.routes.ts — las sub-rutas heredan
//* esa protección, así que aquí no la repetimos (DRY y reduce riesgo de
//* olvidar un guard en una ruta nueva).
export const adminRoutes: Routes = [
  {
    path: '',
    //* Componente "shell" con sidebar y topbar. Las sub-rutas se renderizan
    //* dentro de su <router-outlet />.
    loadComponent: () =>
      import('./layout/admin-layout/admin-layout.component').then(
        module => module.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../dashboard/admin-dashboard/admin-dashboard.component').then(
            module => module.AdminDashboardComponent,
          ),
        title: 'Panel · Admin',
      },
    ],
  },
];
