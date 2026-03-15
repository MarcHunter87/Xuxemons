import { AfterViewChecked, Component, ElementRef, inject, Input, signal } from '@angular/core';
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

  getTypeBadge(): string {
    const type = this.xuxemon?.type?.name || 'Power';
    const filename = `${type}.svg`;
    return this.auth.getAssetUrl(`/badges/${encodeURIComponent(filename)}`);
  }

  getTypeClass(): string {
    return this.xuxemon?.type?.name?.toLowerCase() || 'power';
  }

  openDetails(): void {
    if (!this.xuxemon) return;
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
  }

  isOwnedVariant(): boolean {
    return this.detailVariant === 'owned';
  }
}
