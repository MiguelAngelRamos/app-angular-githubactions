import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

//* OWASP A05 (Security Misconfiguration) — provideHttpClient + withFetch
//* utiliza la Fetch API moderna, que respeta `credentials: 'include'` de
//* forma nativa. Es necesario para que la cookie HttpOnly del refresh
//* token (sameSite=strict) viaje en POST /auth/refresh.
//*
//* OWASP A07 (Authentication Failures) — Orden de los interceptors:
//*   1) authInterceptor PRIMERO  → adjunta el Bearer token, gestiona la
//*      cola durante un refresh en vuelo y reintenta tras 401.
//*   2) errorInterceptor DESPUÉS → recibe el error YA decidido (no el 401
//*      transitorio que el authInterceptor convirtió en éxito tras refresh).
//*      Así evitamos redirigir a /403 o loguear errores que en realidad se
//*      resolvieron con un nuevo access token.
//*
//* Angular ejecuta los interceptors en el orden del array para la request
//* y en orden inverso para la respuesta — por eso authInterceptor envuelve
//* a errorInterceptor y no al revés.
export const appConfig: ApplicationConfig = {
  providers: [
    //* provideBrowserGlobalErrorListeners: captura `error` y `unhandledrejection`
    //* a nivel de window y los enruta a ErrorHandler de Angular. Sin esto, una
    //* promesa rechazada fuera de la zone podría dejar la UI en estado inconsistente.
    provideBrowserGlobalErrorListeners(),

    //* Zoneless change detection — el AuthService se basa en signals (sin Zone.js)
    //* y este modo es el recomendado en Angular v20+. Reduce ruido de change
    //* detection en peticiones HTTP largas (refresh, dashboard).
    provideZonelessChangeDetection(),

    provideRouter(
      routes,
      //* withComponentInputBinding: permite leer params de ruta como `input()`
      //* del componente. Se aprovecha en componentes que reciben :id por la URL.
      withComponentInputBinding(),
      //* withInMemoryScrolling: tras navegación, restaura el scroll en back/forward
      //* y vuelve al top en navegación nueva. Mejora la UX y evita "flash" de
      //* contenido viejo que podría confundir al usuario sobre qué datos ve.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),

    provideHttpClient(
      withFetch(),
      //* OWASP A01/A07 — registramos los interceptors aquí (NO con HTTP_INTERCEPTORS
      //* clásico) porque withInterceptors es la API moderna funcional, soportada
      //* por standalone components y zoneless. El orden importa: ver bloque
      //* explicativo arriba.
      withInterceptors([authInterceptor, errorInterceptor]),
    ),
  ],
};
