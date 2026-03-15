import { Component, inject, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { AuthService } from '../../services/auth';
import type { Xuxemon } from '../../interfaces';

@Component({
  selector: 'app-xuxemon-card',
  imports: [NgClass],
  templateUrl: './xuxemon-card.html',
  styleUrl: './xuxemon-card.css',
})
export class XuxemonCard {
  @Input() xuxemon: Xuxemon | null = null;
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
