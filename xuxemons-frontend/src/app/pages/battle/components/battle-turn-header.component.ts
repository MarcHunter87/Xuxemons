import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-battle-turn-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './battle-turn-header.component.html',
  host: {
    '[style.display]': '"contents"',
  },
})
export class BattleTurnHeaderComponent {
  @Input({ required: true }) vm!: any;
}
