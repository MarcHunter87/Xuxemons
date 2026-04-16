import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-remove-friend-modal',
  standalone: true,
  imports: [],
  templateUrl: './confirm-remove-friend-modal.html',
  styleUrl: './confirm-remove-friend-modal.css',
})
export class ConfirmRemoveFriendModal implements AfterViewInit {
  @Input() friendName = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    queueMicrotask(() => this.focusFirstElement());
  }

  onBackdropClick(): void {
    this.closeModal.emit();
  }

  onConfirmClick(): void {
    this.confirm.emit();
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    this.trapFocus(event);
  }

  private focusFirstElement(): void {
    const root = this.dialogRoot?.nativeElement;
    if (!root) return;
    const focusable = this.getFocusableElements(root);
    (focusable[0] ?? root).focus();
  }

  private trapFocus(event: KeyboardEvent): void {
    const root = this.dialogRoot?.nativeElement;
    if (!root) return;
    const focusable = this.getFocusableElements(root);
    if (focusable.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(root: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    return Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(element => !element.hasAttribute('disabled') && element.tabIndex !== -1);
  }
}
