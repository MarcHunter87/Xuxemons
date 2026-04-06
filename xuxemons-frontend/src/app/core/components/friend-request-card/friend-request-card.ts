import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AuthService } from '../../services/auth';
import type { FriendRequestItem } from '../../interfaces';

@Component({
  selector: 'app-friend-request-card',
  imports: [],
  templateUrl: './friend-request-card.html',
  styleUrl: './friend-request-card.css',
})
export class FriendRequestCard {
  @Input() request!: FriendRequestItem;
  @Output() accept = new EventEmitter<void>();
  @Output() reject = new EventEmitter<void>();

  private auth = inject(AuthService);
  iconError = false;

  get animationsEnabled(): boolean {
    return this.auth.getUser()?.view_animations ?? true;
  }

  getIconUrl(): string {
    if (this.iconError || !this.request?.sender_icon_path) return '';
    return this.auth.getAssetUrl(this.request.sender_icon_path);
  }
}
