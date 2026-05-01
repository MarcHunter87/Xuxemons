import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-battle-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './battle-footer.html',
  styleUrl: './battle-footer.css',
})
export class BattleFooter {
  // Sirve para recibir el view-model del combate desde el componente padre.
  @Input({ required: true }) vm!: any;
}
