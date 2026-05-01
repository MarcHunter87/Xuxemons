import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-battle-victory-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './battle-victory-modal.html',
  styleUrl: './battle-victory-modal.css',
})
// Sirve para el modal de victoria en modo práctica (sin robo de Xuxemon).
export class BattleVictoryModal implements AfterViewInit {
  // Sirve para enlazar el view-model del combate y cerrar el modal de victoria.
  @Input({ required: true }) vm!: any;
  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;

  // Sirve para enfocar el primer elemento
  ngAfterViewInit(): void {
    queueMicrotask(() => this.focusFirstElement());
  }

  // Sirve para cerrar el modal
  onBackdropClick(): void {
    this.vm.closeVictoryModal();
  }

  // Sirve para manejar la tecla Escape
  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.vm.closeVictoryModal();
      return;
    }
    if (event.key !== 'Tab') return;
    this.trapFocus(event);
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
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      element => !element.hasAttribute('disabled') && element.tabIndex !== -1,
    );
  }
}
