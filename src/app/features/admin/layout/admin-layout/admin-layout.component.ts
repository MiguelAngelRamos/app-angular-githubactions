import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

//* Layout del área de administración. Se monta como ruta padre de todas las
//* sub-rutas /admin/** (dashboard y, en el futuro, gestión de pacientes,
//* médicos, especialidades, etc.). Contiene la sidebar de navegación y el
//* topbar con el cerrar-sesión, y deja un <router-outlet /> para el contenido.
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);

  //* Re-exponemos los signals del AuthService directamente. Como son readonly
  //* signals de un servicio singleton, los componentes pueden leerlos sin
  //* duplicarlos ni mantener cache local. Cualquier cambio en la sesión
  //* (logout, refresh) se refleja inmediatamente en la UI.
  protected readonly currentUser = this.authService.currentUser;

  //* `computed` para el iniciar de avatar — capitaliza la primera letra del
  //* email. Se recalcula sólo cuando currentUser cambia, no en cada CD.
  protected readonly userInitial = computed(() => {
    const email = this.currentUser()?.email ?? '';
    return email.charAt(0).toUpperCase() || '?';
  });

  //* Estado local del componente: si la sidebar está colapsada (móvil).
  //* Es estado puramente visual, no tiene que vivir en el AuthService.
  protected readonly isSidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.isSidebarOpen.update(previousState => !previousState);
  }

  protected closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  //* OWASP A01 — el logout invalida la sesión EN EL BACKEND (POST /auth/logout
  //* limpia el refresh token de la DB) y el AuthService limpia los signals.
  //* Después navegamos al login. No usamos location.reload() porque:
  //*   1) Es lento (recarga el bundle).
  //*   2) Se pierde el SPA state si el usuario tenía algo escrito.
  //* clearSessionAndRedirect() ya navega a /login dentro del AuthService.
  protected onLogout(): void {
    this.authService.logout().subscribe({
      //* No hace falta `next` ni `error`: AuthService.logout() siempre acaba
      //* navegando a /login en su `finalize`, incluso si el POST falla por
      //* timeout o el access token ya estaba expirado.
    });
  }
}
