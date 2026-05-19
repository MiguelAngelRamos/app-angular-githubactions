export interface Specialty {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateSpecialtyDto {
  name: string;
  description?: string | null;
}

export interface UpdateSpecialtyDto extends Partial<CreateSpecialtyDto> {}
