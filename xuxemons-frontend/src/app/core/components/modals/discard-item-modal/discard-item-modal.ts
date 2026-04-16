import { FormsModule } from '@angular/forms';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-discard-item-modal',
  imports: [FormsModule],
  templateUrl: './discard-item-modal.html',
  styleUrl: './discard-item-modal.css',
})
export class DiscardItemModal implements AfterViewInit {
  @Input({ required: true }) inventoryContext!: any;
  @Output() closeModal = new EventEmitter<void>();
  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.focusFirstElement();
    });
  }

  onBackdropClick(): void {
    this.closeModal.emit();
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal.emit();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const root = this.dialogRoot?.nativeElement;
    if (!root) {
      return;
    }

    const focusableElements = this.getFocusableElements(root);
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

  private focusFirstElement(): void {
    const root = this.dialogRoot?.nativeElement;
    if (!root) {
      return;
    }

    const focusableElements = this.getFocusableElements(root);
    (focusableElements[0] ?? root).focus();
  }

  private getFocusableElements(root: HTMLElement): HTMLElement[] {
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(element => !element.hasAttribute('disabled') && element.tabIndex !== -1);
  }
}
