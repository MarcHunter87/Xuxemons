import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Xuxemon } from '../../../interfaces';

@Component({
  selector: 'app-battle-steal-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './battle-steal-modal.html',
  styleUrl: './battle-steal-modal.css',
})
export class BattleStealModal implements AfterViewInit {
  // Sirve para enlazar el view-model del combate y la selección de premio.
  @Input({ required: true }) vm!: any;
  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;
  liveMessage = '';

  // Sirve para enfocar el primer elemento
  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.focusFirstElement();
      this.setLiveMessage();
    });
  }

  // Sirve para cerrar el modal
  onBackdropClick(): void {
    this.vm.skipPrizeSelection();
  }

  // Sirve para manejar la tecla Escape
  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.vm.skipPrizeSelection();
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
  isXuxemonType(xuxemon: Xuxemon, kind: 'power' | 'speed' | 'technical'): boolean {
    return (xuxemon.type?.name ?? '').trim().toLowerCase() === kind;
  }

  prizeStat(xuxemon: Xuxemon, stat: 'hp' | 'attack' | 'defense'): number {
    if (stat === 'hp') {
      return xuxemon.current_hp ?? xuxemon.hp ?? 0;
    }
    if (stat === 'attack') {
      return xuxemon.attack ?? 0;
    }
    return xuxemon.defense ?? 0;
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
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      element => !element.hasAttribute('disabled') && element.tabIndex !== -1,
    );
  }

  private setLiveMessage(): void {
    try {
      const options = typeof this.vm?.stealOptions === 'function' ? this.vm.stealOptions() : this.vm?.stealOptions ?? [];
      const count = Array.isArray(options) ? options.length : 0;
      if (count > 0) {
        this.liveMessage = `Choose one Xuxemon. ${count} option${count !== 1 ? 's' : ''} available.`;
      } else {
        this.liveMessage = 'No prize options available.';
      }
    } catch {
      this.liveMessage = '';
    }
  }
}
