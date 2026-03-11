import { Component, inject, OnInit } from '@angular/core';
import { FilterXuxedex } from '../../core/components/filter-xuxedex/filter-xuxedex';
import { XuxemonService } from '../../core/services/xuxemon.service';
import { XuxemonCard } from '../../core/components/xuxemon-card/xuxemon-card';

@Component({
  selector: 'app-xuxedex',
  imports: [FilterXuxedex, XuxemonCard],
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
