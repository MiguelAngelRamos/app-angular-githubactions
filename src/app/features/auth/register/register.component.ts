import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';

//* OWASP A07 (Authentication Failures) — la regex de password debe coincidir
//* EXACTAMENTE con la del backend (`clinic-api/src/auth/dto/register.dto.ts`).
//* El conjunto de caracteres especiales aceptados es estrictamente @$!%*?&;
//* otros símbolos como `#` o `-` NO son válidos en el servidor. Si las regex
//* divergen, un usuario podría pasar la validación del cliente y recibir un
//* 400 confuso del backend.
//*
//* Por qué replicar la regex en cliente:
//*   - UX: feedback inmediato sin viajar al servidor (mejor que esperar el 400).
//*   - NO es seguridad: el backend es la única frontera real (ValidationPipe
//*     con forbidNonWhitelisted lo refuerza). Aquí solo evitamos un round-trip.
const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

//* Validador a nivel de grupo: confirma que `password` y `passwordConfirmation`
//* coinciden. Vive en el grupo, no en el control, porque necesita comparar dos
//* controles hermanos. Se ejecuta cada vez que cualquiera de los dos cambia.
const matchPasswordsValidator: ValidatorFn = (
  formGroup: AbstractControl,
): ValidationErrors | null => {
  const password = formGroup.get('password')?.value;
  const passwordConfirmation = formGroup.get('passwordConfirmation')?.value;
  if (!password || !passwordConfirmation) return null;
  return password === passwordConfirmation ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  //* OWASP A04 (Insecure Design) — política de password explícita y
  //* sincronizada con el backend. El usuario ve los requisitos ANTES de
  //* equivocarse; no se los esconde para "ahorrar UI".
  protected readonly registerForm = this.formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(128),
          Validators.pattern(PASSWORD_POLICY_REGEX),
        ],
      ],
      passwordConfirmation: ['', [Validators.required]],
    },
    { validators: matchPasswordsValidator },
  );

  protected readonly isSubmitting = signal(false);
  protected readonly serverErrorMessage = signal<string | null>(null);
  protected readonly isPasswordVisible = signal(false);

  //* `computed` derivado del valor del form para mostrar checks de política
  //* en vivo. Se recalcula automáticamente cuando el control cambia gracias
  //* a la suscripción al `valueChanges` que aún no hicimos — más abajo.
  protected readonly passwordValue = signal('');

  protected readonly hasUppercase = computed(() => /[A-Z]/.test(this.passwordValue()));
  protected readonly hasLowercase = computed(() => /[a-z]/.test(this.passwordValue()));
  protected readonly hasDigit = computed(() => /\d/.test(this.passwordValue()));
  protected readonly hasSpecialChar = computed(() => /[@$!%*?&]/.test(this.passwordValue()));
  protected readonly hasMinLength = computed(() => this.passwordValue().length >= 8);

  constructor() {
    //* Sincronizamos el signal con el valor del control sin usar effect()
    //* sobre formularios externos: simplemente nos suscribimos a valueChanges.
    //* No nos preocupa el unsubscribe porque el componente y el form viven
    //* exactamente el mismo tiempo (Angular destruye ambos juntos).
    this.registerForm.controls.password.valueChanges.subscribe(passwordValue =>
      this.passwordValue.set(passwordValue ?? ''),
    );
  }

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible.update(previousState => !previousState);
  }

  protected onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.serverErrorMessage.set(null);

    const { email, password } = this.registerForm.getRawValue();

    //* OWASP A01 (Broken Access Control) — Nota: el frontend NUNCA envía
    //* el campo `role`. El backend lo asigna en el servidor (ver registerDto:
    //* "RegisterDto deja de extender CreateUserDto"). Aunque un atacante
    //* manipule el bundle para enviar `role: 'admin'`, el ValidationPipe
    //* del NestJS lo elimina (whitelist:true) o lo rechaza (forbidNonWhitelisted).
    this.authService
      .register(email, password)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (errorResponse: HttpErrorResponse) =>
          this.serverErrorMessage.set(this.toUserFacingMessage(errorResponse)),
      });
  }

  private toUserFacingMessage(errorResponse: HttpErrorResponse): string {
    //* OWASP A07 — el backend devuelve 409 cuando el email ya existe. Aquí
    //* SÍ podemos ser específicos: el usuario está tratando de crear su
    //* propia cuenta, no autenticarse, y necesita saber que debe ir al login.
    if (errorResponse.status === 409) {
      return 'Este email ya está registrado. Si es tuyo, inicia sesión.';
    }
    if (errorResponse.status === 400) {
      return 'Los datos ingresados no son válidos. Revisa el formulario.';
    }
    if (errorResponse.status === 429) {
      return 'Demasiados intentos de registro. Inténtalo de nuevo más tarde.';
    }
    if (errorResponse.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    return 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';
  }
}
