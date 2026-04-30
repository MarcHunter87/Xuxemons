import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-battle-selection-overlay',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './battle-selection-overlay.component.html',
  host: {
    '[style.display]': '"contents"',
  },
})
export class BattleSelectionOverlayComponent {
  @Input({ required: true }) vm!: any;
}
