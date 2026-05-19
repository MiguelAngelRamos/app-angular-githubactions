import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminDashboardData,
  DashboardData,
  PatientDashboardData,
} from '../../core/models/dashboard.models';

//* Servicio de feature — solo habla con el endpoint GET /dashboard. NO vive
//* en core/ porque su uso está acotado al área dashboard. Si en el futuro lo
//* utilizan dos features distintas, lo movemos a core. (Regla del CLAUDE.md
//* del proyecto: "si lo eliminas y solo una feature se rompe, no es de core").
@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);

  //* OWASP A05 — la URL se construye a partir de `environment.apiBaseUrl`
  //* en lugar de un literal hardcodeado, para que en prod apunte al dominio
  //* real sin tener que tocar este archivo.
  private readonly endpoint = `${environment.apiBaseUrl}/dashboard`;

  //* Devuelve la unión discriminada `DashboardData`. El componente que
  //* consume este observable hace `switch (data.role)` y TypeScript fuerza
  //* exhaustividad — si el backend introduce un cuarto rol, este código
  //* sigue compilando pero los componentes verán un type-error que recuerda
  //* añadir la nueva rama.
  //*
  //* No filtramos por rol aquí en el frontend: el BACKEND decide qué forma
  //* devolver según el JWT (ver dashboard.service.ts del NestJS, switch
  //* sobre currentUser.role). Esto cumple con OWASP A01 — la decisión de
  //* acceso vive en el servidor, no en el cliente.
  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(this.endpoint);
  }

  //* Helpers tipados para los componentes que SOLO necesitan una variante.
  //* Usan el mismo endpoint pero documentan en el tipo qué espera el
  //* componente. Si el rol del JWT no coincide, el observable emitirá un
  //* objeto con `role` distinto y el componente puede defenderse haciendo
  //* un check antes de renderizar (defensa en profundidad — el rolesGuard
  //* del frontend ya bloqueó la ruta, esto es solo extra).
  getAdminDashboard(): Observable<AdminDashboardData> {
    return this.http.get<AdminDashboardData>(this.endpoint);
  }

  getPatientDashboard(): Observable<PatientDashboardData> {
    return this.http.get<PatientDashboardData>(this.endpoint);
  }
}
