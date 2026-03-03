import { Component, input } from '@angular/core';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class Collection {
  /** Número de xuxemons en la colección del usuario (por defecto 0). */
  current = input<number>(0);
  /** Total de xuxemons disponibles (por defecto 33). */
  total = input<number>(33);
}
