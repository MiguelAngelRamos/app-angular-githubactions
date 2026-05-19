import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DashboardService } from '../dashboard.service';
import { PatientDashboardData } from '../../../core/models/dashboard.models';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-patient-dashboard',
  imports: [],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);

  //* Saludo personalizado: leemos el email del paciente desde el AuthService
  //* (en memoria, signals). NO almacenamos copia local — el computed se
  //* re-evalúa solo si el usuario cambia (logout/login en otra pestaña).
  protected readonly greetingName = computed(() => {
    const email = this.authService.currentUser()?.email;
    if (!email) return 'paciente';
    //* Tomamos solo la parte local del email para un saludo más cálido.
    //* No es información sensible — el propio usuario logueado lo ve.
    return email.split('@')[0];
  });

  protected readonly isLoading = signal(true);
  protected readonly dashboardData = signal<PatientDashboardData | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly nextAppointment = computed(
    () => this.dashboardData()?.appointments.next ?? null,
  );
  protected readonly upcomingAppointments = computed(
    () => this.dashboardData()?.appointments.upcoming ?? [],
  );
  protected readonly pastAppointmentCount = computed(
    () => this.dashboardData()?.appointments.pastCount ?? 0,
  );
  protected readonly totalAppointmentCount = computed(
    () => this.dashboardData()?.appointments.total ?? 0,
  );

  constructor() {
    this.loadDashboard();
  }

  protected loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.dashboardService.getPatientDashboard().subscribe({
      next: response => {
        if (response.role !== 'patient') {
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

  //* Mismo patrón que en admin-dashboard. El backend puede devolver 403 si
  //* el usuario está autenticado pero NO tiene perfil de paciente creado
  //* (ver `dashboard.service.ts` del NestJS: "No existe perfil de paciente
  //* para este usuario"). Lo traducimos a un mensaje accionable.
  private toUserFacingMessage(errorResponse: HttpErrorResponse): string {
    if (errorResponse.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    if (errorResponse.status === 403) {
      return 'Aún no tienes un perfil de paciente. Completa tu registro para continuar.';
    }
    return 'No se pudo cargar tu panel. Intenta refrescar.';
  }
}
