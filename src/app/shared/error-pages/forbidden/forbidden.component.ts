import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

//* Página de error 403. La utilizan dos sitios:
//*   1) errorInterceptor: redirige aquí cuando una respuesta HTTP devuelve 403
//*      (ej. un paciente intenta GET /patients listando todos — solo admin).
//*   2) rolesGuard: navega aquí con skipLocationChange cuando un usuario
//*      autenticado intenta entrar a un área que no le corresponde
//*      (ej. patient intenta abrir /admin/dashboard).
//*
//* OWASP A01 — el mensaje es genérico ("no tienes permiso") y NO revela
//* qué rol haría falta para ver el recurso. Esto evita que un usuario
//* enumere áreas privilegiadas observando los mensajes de error.
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {
  private readonly location = inject(Location);

  protected goBack(): void {
    this.location.back();
  }
}
