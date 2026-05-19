import { ChangeDetectionStrategy, Component } from '@angular/core';

//* Placeholder mínimo para que la ruta /patient/mi-perfil resuelva. La
//* lógica real (formulario reactivo + PATCH /patients/:id) se construirá
//* en una iteración futura junto con `PatientService`. La pantalla actual
//* deja claro al usuario que la sección existe pero aún no es funcional —
//* preferible a una ruta que devuelve 404 o pantalla en blanco.
@Component({
  selector: 'app-mi-perfil',
  imports: [],
  templateUrl: './mi-perfil.component.html',
  styleUrl: './mi-perfil.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiPerfilComponent {}
