import { AfterViewChecked, Component, ElementRef, HostListener, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminAwardModal } from '../../../core/components/modals/admin-award-modal/admin-award-modal';
import { AdminBanModal } from '../../../core/components/modals/admin-ban-modal/admin-ban-modal';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';
import { AdminUser, BagStatus } from '../../../core/interfaces';

export interface AwardedXuxemonDisplay {
  id: number;
  name: string;
  type: { name: string };
  image_url: string;
  hp: number;
  attack: number;
  defense: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminAwardModal, AdminBanModal],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit, AfterViewChecked {
  private readonly adminService = inject(AdminService);
  public readonly auth = inject(AuthService);

  readonly users = signal<AdminUser[]>([]);
  readonly bagStatusMap = signal<Record<string, BagStatus>>({});
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly showAwardModal = signal(false);
  readonly awardedXuxemon = signal<AwardedXuxemonDisplay | null>(null);
  readonly awardLoadingUserId = signal<string | null>(null);
  readonly banLoadingUserId = signal<string | null>(null);
  readonly showBanModal = signal(false);
  readonly pendingBanUser = signal<AdminUser | null>(null);
  readonly awardError = signal<string | null>(null);
  private previousFocusedElement: HTMLElement | null = null;
  private shouldFocusAwardCloseButton = false;
  @ViewChild('modalAudio') modalAudio?: ElementRef<HTMLAudioElement>;

  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.loadAllUsers();
  }

  // Sirve para manejar el focus del modal de recompensa
  ngAfterViewChecked(): void {
    if (this.shouldFocusAwardCloseButton) {
      this.shouldFocusAwardCloseButton = false;
    }
  }

  // Sirve para cargar todos los usuarios
  private loadAllUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getAllUsers()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          const data = response?.data;
          const list = Array.isArray(data) ? data : [];
          this.users.set(list);

          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading users');
            return;
          }

          list.forEach((user) => this.checkBagStatus(user.id));
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load users');
        },
      });
  }

  // Sirve para verificar el estado de la bolsa del usuario
  private checkBagStatus(userId: string): void {
    this.adminService.checkBagStatus(userId).subscribe({
      next: (response) => {
        this.bagStatusMap.update((map) => ({ ...map, [userId]: response.data }));
      },
      error: () => {},
    });
  }

  // Sirve para verificar si se puede dar items al usuario
  canGiveItems(userId: string): boolean {
    const status = this.bagStatusMap()[userId];
    if (!status) return false;
    return status.available_slots > 0;
  }

  // Sirve para obtener el nombre completo del usuario
  getUserFullName(user: AdminUser): string {
    return `${user.name} ${user.surname}`;
  }

  // Sirve para obtener el ID del usuario codificado
  getEncodedUserId(id: string): string {
    return encodeURIComponent(id);
  }

  // Sirve para dar un Xuxemon aleatorio al usuario
  giveRandomXuxemon(user: AdminUser): void {
    this.previousFocusedElement = typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null;
    this.awardError.set(null);
    this.awardLoadingUserId.set(user.id);
    this.adminService.awardRandomXuxemonToUser(user.id).pipe(
      finalize(() => this.awardLoadingUserId.set(null))
    ).subscribe({
      next: (raw) => {
        const image_url = raw?.icon_path
          ? this.auth.getAssetUrl(`/${raw.icon_path}`, raw?.updated_at)
          : '';
        this.awardedXuxemon.set({
          id: raw?.id,
          name: raw?.name ?? '',
          type: raw?.type ?? { name: '' },
          image_url,
          hp: raw?.hp ?? 0,
          attack: raw?.attack ?? 0,
          defense: raw?.defense ?? 0,
        });
        this.showAwardModal.set(true);
        this.playModalRevealAudio();
        this.shouldFocusAwardCloseButton = true;
      },
      error: (err) => {
        this.awardError.set(err?.error?.message ?? 'Failed to award random Xuxemon');
      },
    });
  }

  // Sirve para banear al usuario
  banUser(user: AdminUser): void {
    this.pendingBanUser.set(user);
    this.showBanModal.set(true);
  }

  // Sirve para cerrar el modal de ban
  closeBanModal(): void {
    this.showBanModal.set(false);
    this.pendingBanUser.set(null);
  }

  // Sirve para confirmar el ban del usuario
  confirmBanUser(): void {
    const user = this.pendingBanUser();
    if (!user) {
      return;
    }

    this.errorMessage.set(null);
    this.banLoadingUserId.set(user.id);
    this.adminService
      .banUser(user.id)
      .pipe(finalize(() => this.banLoadingUserId.set(null)))
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
          this.bagStatusMap.update((map) => {
            const next = { ...map };
            delete next[user.id];
            return next;
          });
          this.closeBanModal();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to ban user');
          this.closeBanModal();
        },
      });
  }

  // Sirve para cerrar el modal de recompensa
  closeAwardModal(): void {
    const sfx = this.modalAudio?.nativeElement;
    if (sfx) { sfx.pause(); sfx.currentTime = 0; }

    this.showAwardModal.set(false);
    this.awardedXuxemon.set(null);
    this.awardError.set(null);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  // Sirve para reproducir el audio de la modal de revelación
  private playModalRevealAudio(): void {
    const sfx = this.modalAudio?.nativeElement;
    if (sfx) {
      sfx.volume = 0.9;
      sfx.currentTime = 0;
      sfx.play().catch(e => console.warn('Modal audio playback prevented', e));
    }
  }

  // Sirve para manejar el escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showBanModal()) {
      this.closeBanModal();
      return;
    }
    if (this.showAwardModal()) {
      this.closeAwardModal();
      return;
    }
    if (this.awardError()) this.dismissAwardError();
  }

  // Sirve para manejar el teclado
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.showAwardModal()) {
      return;
    }
  }

  // Sirve para cerrar el error de recompensa
  dismissAwardError(): void {
    this.awardError.set(null);
  }

  // Sirve para manejar el teclado en la modal de recompensa
  onModalKeydown(event: KeyboardEvent): void {
    if (!this.showAwardModal() || event.key !== 'Tab') return;
  }

  // Sirve para obtener el color del tipo de Xuxemon
  getTypeColor(typeName: string): string {
    switch (typeName) {
      case 'Power': return '#D0181B';
      case 'Speed': return '#0D6EFD';
      case 'Technical': return '#28A745';
      default: return '#777';
    }
  }

  // Sirve para atrapar el focus
  private trapFocus(event: KeyboardEvent, root?: HTMLElement): void {
    if (!root) {
      return;
    }

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusableElements = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(element => !element.hasAttribute('disabled') && element.tabIndex !== -1);

    if (focusableElements.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const activeInside = !!active && root.contains(active);

    if (!activeInside) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
