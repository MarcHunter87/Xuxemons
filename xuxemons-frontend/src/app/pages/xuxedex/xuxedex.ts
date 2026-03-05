import { Component, inject } from '@angular/core';
import { FilterXuxedex } from '../../core/components/filter-xuxedex/filter-xuxedex';
import { Cards } from '../../core/components/cards/cards';
import { XuxemonService } from '../../core/services/xuxemon.service';

@Component({
  selector: 'app-xuxedex',
  imports: [FilterXuxedex, Cards],
  templateUrl: './xuxedex.html',
  styleUrl: './xuxedex.css',
})
export class Xuxedex {
  public xuxemonService = inject(XuxemonService);
  xuxemons = this.xuxemonService.displayXuxemons;
}
