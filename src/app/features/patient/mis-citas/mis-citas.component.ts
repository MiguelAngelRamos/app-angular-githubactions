import { ChangeDetectionStrategy, Component } from '@angular/core';

//* Placeholder mínimo. La pantalla completa de gestión de citas (listar,
//* agendar, cancelar) consumirá GET /appointments y POST /appointments
//* del backend cuando se implemente. Por ahora la ruta resuelve y avisa
//* al usuario de que el módulo está en construcción.
@Component({
  selector: 'app-mis-citas',
  imports: [],
  templateUrl: './mis-citas.component.html',
  styleUrl: './mis-citas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisCitasComponent {}
