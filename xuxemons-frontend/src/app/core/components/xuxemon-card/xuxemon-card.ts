import { AfterViewChecked, Component, ElementRef, HostListener, inject, Input, signal, ViewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { AuthService } from '../../services/auth';
import type { Xuxemon } from '../../interfaces';

@Component({
  selector: 'app-xuxemon-card',
  imports: [NgClass],
  templateUrl: './xuxemon-card.html',
  styleUrl: './xuxemon-card.css',
})
export class XuxemonCard implements AfterViewChecked {
  @Input() xuxemon: Xuxemon | null = null;
  @Input() showSizeBadge = false;
  @Input() detailVariant: 'owned' | 'xuxedex' = 'owned';
  private auth = inject(AuthService);
  private elementRef = inject(ElementRef<HTMLElement>);
  public showDetails = signal(false);
  private focusCloseButton = false;
  private previousFocusedElement: HTMLElement | null = null;

  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;

  getTypeBadge(): string {
    const type = this.xuxemon?.type?.name || 'Power';
    const filename = `${type}.svg`;
    return this.auth.getAssetUrl(`/badges/${encodeURIComponent(filename)}`);
  }

  getTypeClass(): string {
    return this.xuxemon?.type?.name?.toLowerCase() || 'power';
  }

  getSizeClass(): string {
    return this.xuxemon?.size?.toLowerCase() || '';
  }

  getDynamicClasses(): string {
    return [this.getTypeClass(), this.getSizeClass()].filter(Boolean).join(' ');
  }

  openDetails(event?: Event): void {
    if (!this.xuxemon) return;
    const clickTarget = event?.currentTarget;
    this.previousFocusedElement = clickTarget instanceof HTMLElement
      ? clickTarget
      : (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);
    this.showDetails.set(true);
    this.focusCloseButton = true;
  }

  ngAfterViewChecked(): void {
    if (!this.focusCloseButton) return;
    const btn = this.elementRef.nativeElement.querySelector('.modal-close');
    if (btn instanceof HTMLElement) {
      setTimeout(() => btn.focus(), 0);
      this.focusCloseButton = false;
    }
  }

  closeDetails(): void {
    this.showDetails.set(false);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showDetails()) this.closeDetails();
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (!this.showDetails() || event.key !== 'Tab') {
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
      root.focus();
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

  isOwnedVariant(): boolean {
    return this.detailVariant === 'owned';
  }
}
