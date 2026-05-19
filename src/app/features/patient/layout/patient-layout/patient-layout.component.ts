import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

//* Layout del área del paciente. Espejo del AdminLayoutComponent pero con
//* las rutas hijas del paciente (panel, mi perfil, mis citas) y un esquema
//* de color más cálido. Mismo patrón: sidebar fija + topbar con logout.
@Component({
  selector: 'app-patient-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './patient-layout.component.html',
  styleUrl: './patient-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientLayoutComponent {
  private readonly authService = inject(AuthService);

  protected readonly currentUser = this.authService.currentUser;

  protected readonly userInitial = computed(() => {
    const email = this.currentUser()?.email ?? '';
    return email.charAt(0).toUpperCase() || '?';
  });

  protected readonly isSidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.isSidebarOpen.update(previousState => !previousState);
  }

  protected closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  protected onLogout(): void {
    //* Mismo razonamiento que AdminLayout: AuthService.logout siempre
    //* termina llamando a clearSessionAndRedirect() en su finalize, así
    //* que no necesitamos navegar manualmente aquí.
    this.authService.logout().subscribe();
  }
}
