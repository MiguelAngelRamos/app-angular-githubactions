import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  //* `inject()` por encima del constructor: cumple con la convención del
  //* CLAUDE.md del proyecto y permite que las clases sean tree-shakable y
  //* compatibles con migraciones futuras a inyección zoneless.
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  //* OWASP A07 (Authentication Failures) — Validators.email es relativamente
  //* permisivo (sigue HTML5). El backend valida con class-validator y es la
  //* fuente de verdad; aquí solo bloqueamos el envío evidente para mejorar UX.
  //* La longitud mínima de password en frontend NO debe ser inferior a la del
  //* backend — si el back exige 8, aquí también pedimos 8 para que el usuario
  //* no envíe un valor que sabemos que va a fallar.
  protected readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  //* Signals para estado de UI — siguen las convenciones de Angular v20+ y
  //* del CLAUDE.md del proyecto. `isSubmitting` deshabilita el botón mientras
  //* la petición está en vuelo, lo que cumple con OWASP A04 al evitar:
  //*   - Doble envío del formulario (un click impaciente lanza dos POST /login)
  //*   - Amplificación de tráfico contra el rate-limiter del backend (5/min)
  protected readonly isSubmitting = signal(false);
  protected readonly serverErrorMessage = signal<string | null>(null);

  //* Toggle de visibilidad de password — accesibilidad y prevención de typos
  //* sin guardar la password en variable separada (sigue ligada al FormControl).
  protected readonly isPasswordVisible = signal(false);

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible.update(previousState => !previousState);
  }

  protected onSubmit(): void {
    //* OWASP A04 (Insecure Design) — re-marcamos el formulario como tocado
    //* para que los mensajes de validación se muestren incluso si el usuario
    //* dispara el submit con Enter sin haber tocado los campos.
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.serverErrorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    this.authService
      .login(email, password)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        //* En éxito redirigimos a /dashboard. El roleRedirectGuard de esa ruta
        //* leerá el rol del signal `currentUser` (que AuthService.setSession
        //* acaba de poblar dentro del tap del observable) y enviará al usuario
        //* a /admin/dashboard o /patient/dashboard.
        next: () => this.router.navigate(['/dashboard']),
        error: (errorResponse: HttpErrorResponse) =>
          this.serverErrorMessage.set(this.toUserFacingMessage(errorResponse)),
      });
  }

  //* OWASP A07 (Authentication Failures) — mensajes genéricos.
  //* NUNCA decimos "email no encontrado" vs "password incorrecta": ese
  //* detalle permitiría a un atacante enumerar emails registrados en la
  //* clínica (escenario de privacidad médica además de seguridad).
  //* Tampoco mostramos `error.error.message` directamente porque el backend
  //* puede devolver mensajes de validación con detalle interno.
  private toUserFacingMessage(errorResponse: HttpErrorResponse): string {
    if (errorResponse.status === 401) {
      return 'Credenciales inválidas. Verifica tu email y contraseña.';
    }
    if (errorResponse.status === 429) {
      //* OWASP A04 — el backend devuelve 429 cuando se supera el rate limit
      //* (5 intentos/minuto). Damos al usuario un mensaje accionable.
      return 'Demasiados intentos. Espera un minuto antes de volver a intentarlo.';
    }
    if (errorResponse.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    return 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';
  }
}
