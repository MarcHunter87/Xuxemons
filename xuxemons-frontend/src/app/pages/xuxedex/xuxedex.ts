import { Component, inject, OnInit } from '@angular/core';
import { FilterXuxedex } from '../../core/components/filter-xuxedex/filter-xuxedex';
import { Cards } from '../../core/components/cards/cards';
import { XuxemonService } from '../../core/services/xuxemon.service';

@Component({
  selector: 'app-xuxedex',
  imports: [FilterXuxedex, Cards],
  templateUrl: './xuxedex.html',
  styleUrl: './xuxedex.css',
})
export class Xuxedex implements OnInit {
  public xuxemonService = inject(XuxemonService);
  xuxemons = this.xuxemonService.displayXuxemons;

  ngOnInit() {
    this.xuxemonService.typeInventory.set('all');
    this.xuxemonService.loadAllXuxemons();
    this.xuxemonService.loadMyXuxemons();
  }
}
