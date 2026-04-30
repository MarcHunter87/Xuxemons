import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-battle-modals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './battle-modals.component.html',
  host: {
    '[style.display]': '"contents"',
  },
})
export class BattleModalsComponent {
  @Input({ required: true }) vm!: any;
}
