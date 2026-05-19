import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, AuthUser } from '../models/auth.models';
import { BehaviorSubject, catchError, finalize, Observable, of, shareReplay, tap, timeout } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient); // esto es para inyectar el HttpClient sin usar el constructor
  private readonly router = inject(Router); // esto es para inyectar el Router sin usar el constructor

  private readonly _accessToken = signal<string | null>(null); // es null porque al principio no hay token, y luego se va a actualizar con el token que se obtiene al hacer login
  private readonly _currentUser = signal<AuthUser | null>(null); // es null porque al principio no hay usuario, y luego se va a actualizar con el usuario que se obtiene al hacer login
  private refreshRequest$: Observable<AuthResponse> | null = null; // esto es para evitar que se hagan varias peticiones de refresh al mismo tiempo, si ya hay una petición de refresh en curso, se devuelve esa misma petición en lugar de hacer una nueva

  //* H-02: gate observable que indica si hay un refresh en vuelo. El interceptor lo
  //* observa para encolar peticiones nuevas en lugar de dispararlas con el token
  //* viejo (que provocaría un segundo POST /auth/refresh y la consiguiente
  //* detección de reuso del refresh token en NestJS).
  private readonly _isRefreshing$ = new BehaviorSubject<boolean>(false); // esto es para indicar si se está haciendo una petición de refresh, se usa un BehaviorSubject para poder emitir el valor inicial (false) y luego actualizarlo a true cuando se haga la petición de refresh
  readonly isRefreshing$ = this._isRefreshing$.asObservable(); // esto es para exponer el valor de _isRefreshing$ como un Observable, para que los componentes puedan suscribirse a él y saber si se está haciendo una petición de refresh

  readonly accessToken = this._accessToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly isDoctor = computed(() => this._currentUser()?.role === 'doctor');
  readonly isPatient = computed(() => this._currentUser()?.role === 'patient');

  //* helper: expone el valor síncrono del gate para consultas rápidas desde el
  //* interceptor antes de decidir si encolar o disparar el refresh.
  isRefreshing(): boolean {
    return this._isRefreshing$.getValue();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    // { withCredentials: true } es para que el navegador incluya las cookies en la petición, en este caso el refresh token que se guarda como cookie httpOnly
    return this.http.post<AuthResponse>('/api/v1/auth/login', { email, password }, { withCredentials: true })
      .pipe(tap(authResponse => this.setSession(authResponse)));
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/register', { email, password }, { withCredentials: true })
      .pipe(tap(authResponse => this.setSession(authResponse)));
  }

  refresh(): Observable<AuthResponse> {
    if (this.refreshRequest$) return this.refreshRequest$; // si ya hay una petición de refresh en curso, devuelve esa misma petición
    this._isRefreshing$.next(true); // indica que se está haciendo una petición de refresh
    this.refreshRequest$ = this.http.post<AuthResponse>('/api/v1/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap(res => this.setSession(res)), // actualiza el accessToken y el currentUser con la respuesta del refresh
        finalize(() => {
          this.refreshRequest$ = null; // resetea la petición de refresh para permitir futuras peticiones
          this._isRefreshing$.next(false);
        }),
        shareReplay({ bufferSize: 1, refCount: true }) // comparte la misma respuesta entre múltiples suscriptores y evita repetir la petición si ya se ha hecho
      );
    return this.refreshRequest$; // devuelve la petición de refresh para que los componentes puedan suscribirse a ella y obtener el nuevo accessToken y currentUser
  }

  logout(): Observable<void> {
    const token = this._accessToken();
    if (!token) {
      this.clearSessionAndRedirect();
      return of(void 0); // si no hay token, simplemente limpia la sesión y redirige, y devuelve un Observable vacío
    }

    return this.http.post('/api/v1/auth/logout', {}, { headers:{ Authorization: `Bearer ${token}` }, withCredentials: true })
      .pipe(
        timeout({each: 3000}),
        catchError(() => of(void 0)), // si hay un error (timeout o cualquier otro), se ignora y se procede a limpiar la sesión y redirigir de todas formas
        finalize(() => this.clearSessionAndRedirect()), // limpia la sesión y redirige al finalizar la petición, independientemente de si fue exitosa o no
        tap(() => void 0) // esto es para que el Observable devuelto por logout() sea de tipo Observable<void>, ya que ni el catchError ni el finalize emiten ningún valor, y el tap tampoco emite ningún valor, simplemente devuelve void 0 para cumplir con el tipo de retorno
      ) as Observable<void>;
  }

  //* limpieza de estado y redirección extraídas a un método
  //* reutilizable. LogoutBeaconService también la invoca cuando el usuario
  //* cierra la pestaña abruptamente sin pasar por logout().
  clearSessionAndRedirect(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }
  /**
   * Almacena el accessToken y el usuario ÚNICAMENTE en memoria (signals de Angular),
   * nunca en localStorage ni sessionStorage.
   *
   * ¿Por qué? El accessToken es una credencial de corta vida (~15 min) que NO debe
   * persistir en almacenamiento accesible por JavaScript. Si lo guardáramos en
   * localStorage, cualquier script inyectado mediante un ataque XSS podría leerlo y
   * usurpar la sesión del usuario de forma silenciosa.
   *
   * Al vivir solo en memoria:
   *   - Desaparece automáticamente cuando se cierra la pestaña o el proceso.
   *   - Un script malicioso no puede acceder a él leyendo window.localStorage.
   *   - La sesión de larga duración se mantiene mediante el refreshToken, que viaja
   *     exclusivamente como cookie HttpOnly/Secure (inaccesible desde JS).
   *
   * Esta separación de responsabilidades (accessToken en memoria + refreshToken en
   * cookie HttpOnly) es el patrón recomendado por OWASP para SPAs.
   */
  private setSession(authResponse: AuthResponse): void {
    this._accessToken.set(authResponse.accessToken);
    this._currentUser.set(authResponse.user);
  }
}
