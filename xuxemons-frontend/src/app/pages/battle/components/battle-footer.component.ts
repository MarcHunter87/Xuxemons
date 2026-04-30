import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-battle-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './battle-footer.component.html',
  host: {
    '[style.display]': '"contents"',
  },
})
export class BattleFooterComponent {
  @Input({ required: true }) vm!: any;
}
