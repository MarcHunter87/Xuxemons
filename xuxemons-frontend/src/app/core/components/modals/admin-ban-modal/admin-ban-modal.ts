import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-admin-ban-modal',
  standalone: true,
  imports: [],
  templateUrl: './admin-ban-modal.html',
  styleUrl: './admin-ban-modal.css',
})
export class AdminBanModal implements AfterViewInit {
  @Input() userName = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() confirmBan = new EventEmitter<void>();
  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;

  // Sirve para enfocar el primer elemento
  ngAfterViewInit(): void {
    queueMicrotask(() => this.focusFirstElement());
  }

  // Sirve para cerrar el modal
  onBackdropClick(): void {
    this.closeModal.emit();
  }

  // Sirve para manejar la tecla Escape
  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal.emit();
      return;
    }
    // Sirve para manejar la tecla Tab
    if (event.key !== 'Tab') return;
    this.trapFocus(event);
  }

  // Sirve para confirmar la prohibición del usuario
  onConfirmClick(): void {
    this.confirmBan.emit();
  }

  // Sirve para enfocar el primer elemento
  private focusFirstElement(): void {
    const root = this.dialogRoot?.nativeElement;
    if (!root) return;
    const focusable = this.getFocusableElements(root);
    (focusable[0] ?? root).focus();
  }

  // Sirve para atrapar el foco
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

  // Sirve para obtener los elementos focables
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
