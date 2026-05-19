import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { DashboardService } from '../dashboard.service';
import { AdminDashboardData } from '../../../core/models/dashboard.models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [DecimalPipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent {
  private readonly dashboardService = inject(DashboardService);

  //* Tres signals que modelan los estados del fetch — patrón "loading / data
  //* / error" sin necesidad de RxJS streams en plantilla. Cada uno se actualiza
  //* dentro del subscribe del observable. Limpio para usar con @if/@else en
  //* template.
  protected readonly isLoading = signal(true);
  protected readonly dashboardData = signal<AdminDashboardData | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  //* `computed` para derivar valores presentables. Mientras `dashboardData`
  //* es null, los stats devuelven 0. Así el template no necesita `?.` ni
  //* fallbacks por todos lados.
  protected readonly userCount = computed(() => this.dashboardData()?.users.total ?? 0);
  protected readonly doctorCount = computed(() => this.dashboardData()?.doctors.total ?? 0);
  protected readonly patientCount = computed(() => this.dashboardData()?.patients.total ?? 0);
  protected readonly specialtyCount = computed(() => this.dashboardData()?.specialties.total ?? 0);
  protected readonly appointmentTotal = computed(
    () => this.dashboardData()?.appointments.total ?? 0,
  );
  protected readonly appointmentToday = computed(
    () => this.dashboardData()?.appointments.today ?? 0,
  );
  protected readonly usersByRole = computed(
    () => this.dashboardData()?.users.byRole ?? { admin: 0, doctor: 0, patient: 0 },
  );

  constructor() {
    this.loadDashboard();
  }

  protected loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    //* OWASP A01 + A04 — confiamos en que la respuesta tiene `role: 'admin'`
    //* porque la ruta está protegida por rolesGuard(['admin']) y el backend
    //* solo devuelve la forma admin a usuarios admin. Si por alguna razón
    //* llega otra forma, el `switch` defensivo lo trata como error.
    this.dashboardService.getAdminDashboard().subscribe({
      next: response => {
        if (response.role !== 'admin') {
          this.errorMessage.set('Respuesta inesperada del servidor.');
          this.isLoading.set(false);
          return;
        }
        this.dashboardData.set(response);
        this.isLoading.set(false);
      },
      error: (errorResponse: HttpErrorResponse) => {
        this.errorMessage.set(this.toUserFacingMessage(errorResponse));
        this.isLoading.set(false);
      },
    });
  }

  //* Mensajes genéricos — mismas reglas que en login. Los detalles internos
  //* (status text crudo, message del backend) los registra SafeLogger en
  //* errorInterceptor; aquí solo decimos al usuario qué hacer.
  private toUserFacingMessage(errorResponse: HttpErrorResponse): string {
    if (errorResponse.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    if (errorResponse.status === 403) {
      return 'No tienes permisos para ver este panel.';
    }
    return 'No se pudo cargar el panel. Intenta refrescar.';
  }
}
