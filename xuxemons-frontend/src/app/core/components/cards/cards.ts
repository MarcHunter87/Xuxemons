import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
})
export class Cards {
  @Input() xuxemon: any;

  getTypeBadge(): string {
    const type = this.xuxemon?.type?.name || 'Power';
    let filename = 'Types=Power.svg';
    if (type === 'Speed') filename = 'Speed 2.svg';
    if (type === 'Technical') filename = 'Technical 1.svg';
    return `http://localhost:8001/Badges/${filename}`;
  }

  getTypeClass(): string {
    return this.xuxemon?.type?.name?.toLowerCase() || 'power';
  }
}
