import { AfterViewChecked, Component, ElementRef, HostListener, inject, Input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { XuxemonDetailModal } from '../modals/xuxemon-detail-modal/xuxemon-detail-modal';
import { AuthService } from '../../services/auth';
import type { Xuxemon } from '../../interfaces';

@Component({
  selector: 'app-xuxemon-card',
  imports: [NgClass, XuxemonDetailModal],
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

  // Sirve para obtener la URL del badge del tipo de Xuxemon
  getTypeBadge(): string {
    const type = this.xuxemon?.type?.name || 'Power';
    const filename = `${type}.svg`;
    return this.auth.getAssetUrl(`/badges/${encodeURIComponent(filename)}`);
  }

  // Sirve para obtener la clase del tipo de Xuxemon
  getTypeClass(): string {
    return this.xuxemon?.type?.name?.toLowerCase() || 'power';
  }

  // Sirve para obtener la clase del tamaño de Xuxemon
  getSizeClass(): string {
    return this.xuxemon?.size?.toLowerCase() || '';
  }

  // Sirve para obtener las clases dinámicas
  getDynamicClasses(): string {
    return [this.getTypeClass(), this.getSizeClass()].filter(Boolean).join(' ');
  }

  // Sirve para abrir los detalles del Xuxemon
  openDetails(event?: Event): void {
    if (!this.xuxemon) return;
    const clickTarget = event?.currentTarget;
    this.previousFocusedElement = clickTarget instanceof HTMLElement
      ? clickTarget
      : (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);
    this.showDetails.set(true);
    this.focusCloseButton = true;
  }

  // Sirve para verificar si el botón de cerrar está enfocado
  ngAfterViewChecked(): void {
    if (!this.focusCloseButton) return;
    const btn = this.elementRef.nativeElement.querySelector('.modal-close');
    if (btn instanceof HTMLElement) {
      setTimeout(() => btn.focus(), 0);
      this.focusCloseButton = false;
    }
  }

  // Sirve para cerrar los detalles del Xuxemon
  closeDetails(): void {
    this.showDetails.set(false);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  // Sirve para manejar la tecla Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showDetails()) this.closeDetails();
  }

  // Sirve para verificar si el Xuxemon es de tipo propio
  isOwnedVariant(): boolean {
    return this.detailVariant === 'owned';
  }
}
