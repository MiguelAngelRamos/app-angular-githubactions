import { Routes } from '@angular/router';

//* Rutas del área del paciente. Heredan los guards de la ruta padre `/patient`
//* declarada en app.routes.ts (authGuard + rolesGuard(['patient']) + canMatch).
//* Por eso aquí no se vuelven a aplicar — sería redundante y daría más
//* superficie de bug si en el futuro alguien añade una sub-ruta y olvida un guard.
export const patientRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/patient-layout/patient-layout.component').then(
        module => module.PatientLayoutComponent,
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
          import('../dashboard/patient-dashboard/patient-dashboard.component').then(
            module => module.PatientDashboardComponent,
          ),
        title: 'Mi panel · Clínica',
      },
      {
        path: 'mis-citas',
        loadComponent: () =>
          import('./mis-citas/mis-citas.component').then(module => module.MisCitasComponent),
        title: 'Mis citas · Clínica',
      },
      {
        path: 'mi-perfil',
        loadComponent: () =>
          import('./mi-perfil/mi-perfil.component').then(module => module.MiPerfilComponent),
        title: 'Mi perfil · Clínica',
      },
    ],
  },
];
