import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  //* H-02: las peticiones contra /auth/login, /auth/register, /auth/refresh y
  //* /auth/logout no deben pasar por la lógica de gate ni de retry (un 401 en
  //* /auth/login significa "credenciales inválidas", no "token expirado").
  const isAuthEndpoint = req.url.includes('/auth/');

  //* H-02: si hay un refresh en vuelo y NO es una petición de auth, encolamos.
  //* Esto evita la "Ventana B": una petición que arranca después de iniciado el
  //* refresh saldría con el token viejo, recibiría 401 y dispararía un SEGUNDO
  //* POST /auth/refresh — NestJS lo interpretaría como reuso de refresh token y
  //* revocaría la sesión legítima.
  if (!isAuthEndpoint && authService.isRefreshing()) {
    return authService.isRefreshing$.pipe(
      filter(refreshing => !refreshing),
      take(1),
      switchMap(() => sendWithCurrentToken(req, next, authService)),
    );
  }

  return sendWithCurrentToken(req, next, authService).pipe(
    catchError((error: HttpErrorResponse) => {
      //* ¿Qué es un HTTP 401 Unauthorized?
      //* El servidor devuelve 401 cuando NO puede identificar quién hace la
      //* petición. Las causas más comunes son:
      //*   - El token de acceso (JWT) ha expirado o no se ha enviado.
      //*   - Las credenciales son incorrectas (ej. contraseña errónea en /login).
      //* NO confundir con 403 Forbidden, que sí identifica al usuario pero le
      //* niega el acceso por falta de permisos (ej. un paciente intentando
      //* acceder a /admin). Por eso este interceptor solo actúa ante 401 fuera
      //* de los endpoints de auth: en /login un 401 significa "credenciales
      //* inválidas", no "token expirado", y no tiene sentido intentar un refresh.
      //* Fuera de auth, aprovechamos el 401 para renovar el JWT silenciosamente
      //* (vía refresh token) y reintentar la petición original sin que el
      //* usuario note nada.
      //*
      //* H-02: solo intentamos refrescar para 401 fuera de endpoints de auth.
      //* Un 401 en /auth/refresh significa que el refresh cookie también expiró
      //* o fue revocado → cerrar sesión sin reintentar.
      if (error.status === 401 && !isAuthEndpoint) {
        //* H-02: si OTRA petición ya disparó el refresh esperamos al gate.
        //* Solo la primera petición que llega aquí con el gate en false
        //* dispara realmente el POST /auth/refresh — el resto se cuelga del
        //* shareReplay del AuthService.refresh().
        return authService.refresh().pipe(
          switchMap(() => sendWithCurrentToken(req, next, authService)),
          catchError(refreshError => {
            //* H-03: usamos clearSessionAndRedirect() en lugar de logout()
            //* completo — si el refresh falló el JWT viejo ya no nos sirve y
            //* no tiene sentido intentar otro POST /auth/logout que también
            //* fallará. El backend ya rotó/revocó el refresh.
            authService.clearSessionAndRedirect();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};

//* H-02: helper que adjunta el token vigente en cada envío. Lo extraemos para
//* poder reutilizarlo tanto en el envío inicial como en el reintento tras el
//* refresh — ambos deben leer el token EN EL MOMENTO del envío, no antes (de
//* lo contrario el reintento usaría el token viejo cacheado en una variable).
function sendWithCurrentToken(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService) {
  const token = authService.accessToken();

  //* Operador ternario: comprobamos si existe un token de acceso en memoria.
  //*
  //* Rama TRUE (hay token):
  //*   Clonamos la petición original añadiéndole la cabecera Authorization con
  //*   el esquema Bearer — así el backend puede identificar al usuario — y
  //*   activamos withCredentials para que el navegador adjunte también la cookie
  //*   HttpOnly del refresh token.
  //*
  //* Rama FALSE (no hay token). Los casos más comunes son:
  //*   - /auth/login: el usuario aún no tiene token, está intentando obtenerlo.
  //*   - /auth/register: es la primera vez que interactúa con la app.
  //*   - Al arrancar la app: si el usuario tenía sesión pero cerró la pestaña,
  //*     el token en memoria se pierde. El authGuard llama a /auth/refresh antes
  //*     de tener token, por lo que también pasa por esta rama.
  //*   En todos estos casos enviamos la petición sin Authorization pero con
  //*   withCredentials, que permite al navegador adjuntar la cookie HttpOnly del
  //*   refresh token — imprescindible para renovar la sesión al arrancar la app.
  //*
  //* Usamos req.clone() en ambos casos porque las peticiones HTTP de Angular son
  //* inmutables por diseño — una vez creadas no se pueden alterar directamente.
  //* Esto es intencional: garantiza que ningún interceptor pueda modificar
  //* silenciosamente la petición original que otro código ya tiene referenciada,
  //* evitando efectos secundarios impredecibles.
  //* req.clone() crea una copia nueva con los cambios indicados (en este caso
  //* añadir la cabecera Authorization), dejando la original intacta. El resultado
  //* del clone es lo que se envía realmente al backend.
  const authenticatedRequest = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
    : req.clone({ withCredentials: true });

  //* Pasamos la petición (ya clonada y autenticada) al siguiente manejador
  //* de la cadena de interceptores, o al backend si no hay más interceptores.
  return next(authenticatedRequest);
}
