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
  @Input() challengePending = false;
  @Output() remove = new EventEmitter<void>();
  @Output() challenge = new EventEmitter<FriendUser>();

  private auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  menuOpen = false;
  iconError = false;

  // Sirve para verificar si las animaciones están habilitadas
  get animationsEnabled(): boolean {
    return this.auth.getUser()?.view_animations ?? true;
  }

  // Sirve para obtener la URL del icono
  getIconUrl(): string {
    if (this.iconError || !this.friend?.icon_path) return '';
    return this.auth.getAssetUrl(this.friend.icon_path);
  }

  // Sirve para obtener el texto del estado
  getStatusText(): string {
    return this.friend.status === 'online' ? 'Online' : 'Offline';
  }

  // Sirve para alternar el menú
  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  // Sirve para eliminar al amigo
  onRemove(): void {
    this.menuOpen = false;
    this.remove.emit();
  }

  // Sirve para lanzar un challenge de batalla
  onChallenge(): void {
    if (this.challengePending) {
      return;
    }

    this.challenge.emit(this.friend);
  }

  // Sirve para manejar el clic en el documento
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.menuOpen) this.menuOpen = false;
  }
}
