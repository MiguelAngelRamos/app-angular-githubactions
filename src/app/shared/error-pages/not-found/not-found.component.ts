import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

//* Página de error 404. Se monta en la ruta '/404' y como wildcard '**'.
//* uuid-params.guard.ts redirige aquí con `skipLocationChange:true` cuando
//* detecta un UUID malformado en la URL — por eso también ofrecemos un
//* botón "Volver" usando Location.back() en lugar de router.navigate, así
//* el usuario regresa al estado anterior aunque la URL prohibida no esté
//* en el historial.
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  private readonly location = inject(Location);

  protected goBack(): void {
    this.location.back();
  }
}
