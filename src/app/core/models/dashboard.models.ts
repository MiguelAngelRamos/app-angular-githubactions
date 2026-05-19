import { AppointmentStatus } from './appointment.models';

//* Tipos espejo de `clinic-api/src/dashboard/dashboard.service.ts`. El backend
//* devuelve un objeto distinto según el rol del usuario autenticado y el campo
//* `role` actúa como discriminador de unión — por eso usamos `union types`
//* etiquetadas: TypeScript estrechará el tipo automáticamente al hacer
//* `if (data.role === 'patient')` en los componentes, evitando casts unsafe.

//* Resumen mínimo de cita devuelto por el dashboard. El backend NUNCA serializa
//* el Appointment completo aquí — solo estos campos — para no exponer userId,
//* email, teléfono u otros datos sensibles del paciente o del médico (OWASP A02
//* Cryptographic Failures / exposición de datos).
export interface AppointmentSummary {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  //* Nombre del médico cuando el dashboard es del paciente, o nombre del
  //* paciente cuando el dashboard es del médico. El backend lo determina
  //* a partir del rol y los componentes solo lo muestran como string —
  //* no hay que decidir nada en frontend.
  counterpartName: string;
}

export interface AdminDashboardData {
  role: 'admin';
  users: {
    total: number;
    byRole: { admin: number; doctor: number; patient: number };
  };
  appointments: {
    total: number;
    today: number;
    byStatus: Partial<Record<AppointmentStatus, number>>;
  };
  doctors: { total: number };
  patients: { total: number };
  specialties: { total: number };
}

export interface DoctorDashboardData {
  role: 'doctor';
  appointments: {
    today: AppointmentSummary[];
    upcoming: AppointmentSummary[];
    pendingConfirmation: number;
    total: number;
  };
  patients: { total: number };
}

export interface PatientDashboardData {
  role: 'patient';
  appointments: {
    next: AppointmentSummary | null;
    upcoming: AppointmentSummary[];
    pastCount: number;
    total: number;
  };
}

//* Unión discriminada — el frontend hace `switch (data.role)` y TypeScript
//* fuerza a manejar los tres casos. Si en el futuro se añade un cuarto rol
//* en el backend, el compilador romperá aquí avisándonos de qué pantallas
//* hay que actualizar (exhaustiveness check).
export type DashboardData =
  | AdminDashboardData
  | DoctorDashboardData
  | PatientDashboardData;
