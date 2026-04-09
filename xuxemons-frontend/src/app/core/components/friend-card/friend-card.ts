import { Component, EventEmitter, HostListener, Input, Output, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth';
import type { FriendUser } from '../../interfaces';

@Component({
  selector: 'app-friend-card',
  imports: [],
  templateUrl: './friend-card.html',
  styleUrl: './friend-card.css',
})
export class FriendCard {
  @Input() friend!: FriendUser;
  @Output() remove = new EventEmitter<void>();

  private auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  menuOpen = false;
  iconError = false;

  get animationsEnabled(): boolean {
    return this.auth.getUser()?.view_animations ?? true;
  }

  getIconUrl(): string {
    if (this.iconError || !this.friend?.icon_path) return '';
    return this.auth.getAssetUrl(this.friend.icon_path);
  }

  getStatusText(): string {
    return this.friend.status === 'online' ? 'Online' : 'Offline';
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  onRemove(): void {
    this.menuOpen = false;
    this.remove.emit();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.menuOpen) this.menuOpen = false;
  }
}
