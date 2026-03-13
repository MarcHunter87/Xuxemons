import { Component, inject, Input } from '@angular/core';
import { AuthService } from '../../services/auth';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-xuxemon-card',
  imports: [CommonModule],
  templateUrl: './xuxemon-card.html',
  styleUrl: './xuxemon-card.css',
})
export class XuxemonCard {
  @Input() xuxemon: any;
  @Input() showSizeBadge = false;
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
