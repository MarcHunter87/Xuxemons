import { Component } from '@angular/core';
import { CatalogoXuxemon } from '../../core/components/catalogo-Xuxemon/catalogo-Xuxemon';
import { FilterXuxedex } from '../../core/components/filter-xuxedex/filter-xuxedex';


@Component({
  selector: 'app-xuxedex',
  imports: [CatalogoXuxemon, FilterXuxedex],
  templateUrl: './xuxedex.html',
  styleUrl: './xuxedex.css',
})
export class Xuxedex {

}
