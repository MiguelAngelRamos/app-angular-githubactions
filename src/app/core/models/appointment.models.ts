import { Doctor } from './doctor.models';
import { Patient } from './patient.models';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes: string | null;
  patient?: Patient;
  doctor?: Doctor;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

export interface UpdateAppointmentDto extends Partial<CreateAppointmentDto> {}

export interface UpdateAppointmentStatusDto {
  status: AppointmentStatus;
}
