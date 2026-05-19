export type Gender = 'male' | 'female' | 'other';

export interface Patient {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  gender: Gender | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  gender?: Gender | null;
  phone?: string | null;
  address?: string | null;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}
