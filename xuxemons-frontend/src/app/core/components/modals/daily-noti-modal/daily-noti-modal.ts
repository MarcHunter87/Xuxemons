import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AuthService } from '../../../services/auth';
import type { DailyRewardNotification } from '../../../interfaces';

@Component({
  selector: 'app-daily-noti-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-noti-modal.html',
  styleUrls: ['./daily-noti-modal.css'],
})
export class DailyNotiModal implements OnChanges, AfterViewChecked {
  @Input() open = false;
  @Input() notification: DailyRewardNotification | null = null;
  @Output() closeModal = new EventEmitter<void>();

  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;
  @ViewChild('confirmButton') confirmButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('modalAudio') modalAudio?: ElementRef<HTMLAudioElement>;

  private previousFocusedElement: HTMLElement | null = null;
  private shouldFocusPrimaryAction = false;
  private shouldFocusRoot = false;

  // Sirve para inyectar el servicio de autenticación
  constructor(public auth: AuthService) {}

  // Sirve para manejar los cambios de apertura del modal
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && !changes['open']?.previousValue) {
      this.previousFocusedElement = typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
      this.shouldFocusRoot = true;
      this.shouldFocusPrimaryAction = true;
      this.playModalRevealAudio();
    }
  }

  // Sirve para verificar si el foco debe enfocarse en el elemento raíz
  ngAfterViewChecked(): void {
    if (this.shouldFocusRoot && this.dialogRoot?.nativeElement) {
      this.dialogRoot.nativeElement.focus();
      this.shouldFocusRoot = false;
    }
    if (this.shouldFocusPrimaryAction && this.confirmButton?.nativeElement) {
      this.confirmButton.nativeElement.focus();
      this.shouldFocusPrimaryAction = false;
    }
  }

  // Sirve para manejar la tecla Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.handleClose();
    }
  }

  // Sirve para manejar la tecla Tab
  onModalKeydown(event: KeyboardEvent): void {
    if (!this.open || event.key !== 'Tab') {
      return;
    }

    const root = this.dialogRoot?.nativeElement;
    if (!root) {
      return;
    }

    // Sirve para obtener los elementos focables
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
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const active = document.activeElement as HTMLElement | null;

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

  // Sirve para verificar si el usuario debe animar
  shouldAnimate(): boolean {
    const user = this.auth.getUser();
    if (!user) return true;
    const val = (user as any).view_animations;
    if (val === false) return false;
    if (val === 0) return false;
    if (val === '0' || val === 'false') return false;
    return true;
  }

  // Sirve para cerrar el modal
  handleClose(): void {
    const sfx = this.modalAudio?.nativeElement;
    if (sfx) { sfx.pause(); sfx.currentTime = 0; }

    this.closeModal.emit();

    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  // Sirve para reproducir el audio del modal
  private playModalRevealAudio(): void {
    const sfx = this.modalAudio?.nativeElement;
    if (sfx) {
      sfx.volume = 0.9;
      sfx.currentTime = 0;
      sfx.play().catch(e => console.warn('Daily modal audio playback prevented', e));
    }
  }

  // Sirve para verificar si hay recompensas de gacha
  hasGachaRewards(): boolean {
    return (this.notification?.gacha_ticket?.quantity ?? 0) > 0;
  }

  // Sirve para verificar si hay recompensas de items
  hasItemRewards(): boolean {
    return (this.notification?.items?.length ?? 0) > 0;
  }

  // Sirve para verificar si hay recompensas
  hasAnyRewards(): boolean {
    return this.hasGachaRewards() || this.hasItemRewards();
  }

  // Sirve para obtener la clase del slot
  getSlotClass(effectType?: string | null): string {
    const normalized = (effectType || 'default').toLowerCase().trim().replace(/ /g, '-');
    return `slot-bg-${normalized}`;
  }

}
