import { Specialty } from './specialty.models';

export interface Doctor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string | null;
  specialties: Specialty[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDoctorDto {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone?: string | null;
}

export interface UpdateDoctorDto extends Partial<CreateDoctorDto> {}
