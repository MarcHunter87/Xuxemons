import { Component, inject } from '@angular/core';
import { Cards } from '../cards/cards';
import { XuxemonService } from '../../services/xuxemon.service';

@Component({
  selector: 'app-catalogo-Xuxemon',
  standalone: true,
  imports: [Cards],
  templateUrl: './catalogo-Xuxemon.html',
  styleUrl: './catalogo-Xuxemon.css',
})
export class CatalogoXuxemon {
  xuxemons = inject(XuxemonService).xuxemons;
}
