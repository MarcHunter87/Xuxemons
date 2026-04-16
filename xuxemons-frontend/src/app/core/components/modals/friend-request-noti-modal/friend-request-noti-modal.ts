import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AuthService } from '../../../services/auth';
import type { FriendRequestItem } from '../../../interfaces';

@Component({
  selector: 'app-friend-request-noti-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './friend-request-noti-modal.html',
  styleUrls: ['./friend-request-noti-modal.css'],
})
export class FriendRequestNotiModal implements OnChanges, AfterViewChecked {
  @Input() open = false;
  @Input() requests: FriendRequestItem[] = [];
  @Output() closeModal = new EventEmitter<void>();
  @Output() acceptRequest = new EventEmitter<FriendRequestItem>();
  @Output() rejectRequest = new EventEmitter<FriendRequestItem>();

  @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;
  @ViewChild('primaryButton') primaryButton?: ElementRef<HTMLButtonElement>;

  private previousFocusedElement: HTMLElement | null = null;
  private shouldFocusRoot = false;
  private shouldFocusPrimaryAction = false;
  iconErrors: Record<string, boolean> = {};

  constructor(public auth: AuthService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && !changes['open']?.previousValue) {
      this.previousFocusedElement = typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
      this.shouldFocusRoot = true;
      this.shouldFocusPrimaryAction = true;
      this.iconErrors = {};
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocusRoot && this.dialogRoot?.nativeElement) {
      this.dialogRoot.nativeElement.focus();
      this.shouldFocusRoot = false;
    }
    if (this.shouldFocusPrimaryAction && this.primaryButton?.nativeElement) {
      this.primaryButton.nativeElement.focus();
      this.shouldFocusPrimaryAction = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.handleClose();
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (!this.open || event.key !== 'Tab') return;
    const root = this.dialogRoot?.nativeElement;
    if (!root) return;

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusable = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);

    if (focusable.length === 0) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); return; }
    if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  shouldAnimate(): boolean {
    const user = this.auth.getUser();
    if (!user) return true;
    const val = (user as any).view_animations;
    if (val === false || val === 0 || val === '0' || val === 'false') return false;
    return true;
  }

  handleClose(): void {
    this.closeModal.emit();
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  onAccept(req: FriendRequestItem): void {
    this.acceptRequest.emit(req);
  }

  onReject(req: FriendRequestItem): void {
    this.rejectRequest.emit(req);
  }

  getIconUrl(iconPath: string | null | undefined): string {
    if (!iconPath) return '';
    return this.auth.getAssetUrl(iconPath);
  }

  onIconError(id: string): void {
    this.iconErrors[id] = true;
  }
}
