import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
})
export class Cards {
  @Input() xuxemon: any;
  private auth = inject(AuthService);

  getTypeBadge(): string {
    const type = this.xuxemon?.type?.name || 'Power';
    const filename = `${type}.svg`;
    return this.auth.getAssetUrl(`/badges/${encodeURIComponent(filename)}`);
  }

  getTypeClass(): string {
    return this.xuxemon?.type?.name?.toLowerCase() || 'power';
  }
}
