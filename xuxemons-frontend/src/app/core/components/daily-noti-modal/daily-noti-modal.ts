import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AuthService } from '../../services/auth';
import type { DailyRewardNotification } from '../../interfaces';

@Component({
  selector: 'app-daily-noti-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-noti-modal.html',
  styleUrl: './daily-noti-modal.css',
})
export class DailyNotiModal implements OnChanges, AfterViewChecked {
  @Input() open = false;
  @Input() notification: DailyRewardNotification | null = null;
  @Output() closeModal = new EventEmitter<void>();

  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;
  @ViewChild('confirmButton') confirmButton?: ElementRef<HTMLButtonElement>;

  private previousFocusedElement: HTMLElement | null = null;
  private shouldFocusPrimaryAction = false;
  private shouldFocusRoot = false;

  constructor(public auth: AuthService) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && !changes['open']?.previousValue) {
      this.previousFocusedElement = typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
      this.shouldFocusRoot = true;
      this.shouldFocusPrimaryAction = true;
    }
  }

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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.handleClose();
    }
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (!this.open || event.key !== 'Tab') {
      return;
    }

    const root = this.dialogRoot?.nativeElement;
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

  shouldAnimate(): boolean {
    const user = this.auth.getUser();
    if (!user) return true;
    const val = (user as any).view_animations;
    if (val === false) return false;
    if (val === 0) return false;
    if (val === '0' || val === 'false') return false;
    return true;
  }

  handleClose(): void {
    this.closeModal.emit();

    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  hasGachaRewards(): boolean {
    return (this.notification?.gacha_ticket?.quantity ?? 0) > 0;
  }

  hasItemRewards(): boolean {
    return (this.notification?.items?.length ?? 0) > 0;
  }

  hasAnyRewards(): boolean {
    return this.hasGachaRewards() || this.hasItemRewards();
  }

  getSlotClass(effectType?: string | null): string {
    const normalized = (effectType || 'default').toLowerCase().trim().replace(/ /g, '-');
    return `slot-bg-${normalized}`;
  }

}
