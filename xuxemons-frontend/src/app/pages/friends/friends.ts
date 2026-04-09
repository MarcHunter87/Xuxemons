import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth';
import { FriendsService } from '../../core/services/friends.service';
import { FriendCard } from '../../core/components/friend-card/friend-card';
import { FriendRequestCard } from '../../core/components/friend-request-card/friend-request-card';
import type { FriendUser, FriendRequestItem, SearchUser } from '../../core/interfaces';

@Component({
  selector: 'app-friends',
  imports: [FriendCard, FriendRequestCard, ReactiveFormsModule],
  templateUrl: './friends.html',
  styleUrl: './friends.css',
})
export class Friends implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private friendsService = inject(FriendsService);
  private subs = new Subscription();

  searchControl = new FormControl('');

  friends = signal<FriendUser[]>([]);
  pendingRequests = signal<FriendRequestItem[]>([]);
  searchResults = signal<SearchUser[]>([]);
  searchLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  confirmRemoveFriend = signal<FriendUser | null>(null);
  sendingRequestTo = signal<string[]>([]);
  searchIconErrors = signal<string[]>([]);

  @ViewChild('confirmDialog') confirmDialog?: ElementRef<HTMLElement>;
  @ViewChild('confirmPrimary') confirmPrimary?: ElementRef<HTMLButtonElement>;

  private previousFocusedElement: HTMLElement | null = null;
  private shouldFocusRoot = false;
  private shouldFocusPrimaryAction = false;

  get pendingCount(): number {
    return this.pendingRequests().length;
  }

  get animationsEnabled(): boolean {
    return this.auth.getUser()?.view_animations ?? true;
  }

  get showSearchResults(): boolean {
    const q = this.searchControl.value ?? '';
    return q.length >= 3;
  }

  ngOnInit(): void {
    this.subs.add(
      this.friendsService.friends.subscribe(f => {
        this.friends.set(f);

        // If a user became a friend, clear any request flags
        if (this.searchResults().length > 0) {
          const friendIds = f.map(ff => ff.id);
          this.searchResults.set(
            this.searchResults().map(u => friendIds.includes(u.id)
              ? { ...u, request_received: false, request_sent: false }
              : u
            ),
          );
        }
      }),
    );
    this.subs.add(
      this.friendsService.pendingRequests.subscribe(r => {
        this.pendingRequests.set(r);

        // Update any displayed search results to reflect pending requests
        if (this.searchResults().length > 0) {
          const pendingSenderIds = r.map(pr => pr.sender_id);
          this.searchResults.set(
            this.searchResults().map(u => ({
              ...u,
              request_received: pendingSenderIds.includes(u.id),
            })),
          );
        }
      }),
    );

    // Clear results when query is too short
    this.subs.add(
      this.searchControl.valueChanges.pipe(
        filter(q => !q || q.length < 3),
      ).subscribe(() => {
        this.searchResults.set([]);
        this.searchLoading.set(false);
      }),
    );

    // Search with debounce when ≥3 chars
    this.subs.add(
      this.searchControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((q): q is string => !!q && q.length >= 3),
      ).subscribe(q => {
        this.searchLoading.set(true);
        this.friendsService.searchUsers(q).subscribe({
          next: results => {
            this.searchResults.set(results);
            this.searchLoading.set(false);
          },
          error: () => this.searchLoading.set(false),
        });
      }),
    );

    this.friendsService.loadAll();
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocusRoot && this.confirmDialog?.nativeElement) {
      this.confirmDialog.nativeElement.focus();
      this.shouldFocusRoot = false;
    }
    if (this.shouldFocusPrimaryAction && this.confirmPrimary?.nativeElement) {
      this.confirmPrimary.nativeElement.focus();
      this.shouldFocusPrimaryAction = false;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  sendRequest(user: SearchUser): void {
    const current = [...this.sendingRequestTo()];
    if (!current.includes(user.id)) current.push(user.id);
    this.sendingRequestTo.set(current);

    this.errorMessage.set(null);
    this.friendsService.sendRequest(user.id).subscribe({
      next: res => {
        this.searchResults.set(
          this.searchResults().map(u =>
            u.id === user.id ? { ...u, request_sent: true } : u,
          ),
        );
        const cur = this.sendingRequestTo().filter(id => id !== user.id);
        this.sendingRequestTo.set(cur);

        if (res?.auto_accepted) {
          this.friendsService.loadFriends();
          this.successMessage.set('Friend added!');
        } else {
          this.successMessage.set('Friend request sent!');
        }
      },
      error: err => {
        const cur = this.sendingRequestTo().filter(id => id !== user.id);
        this.sendingRequestTo.set(cur);
        this.errorMessage.set(err?.error?.message ?? 'Failed to send request.');
      },
    });
  }

  cancelSentRequest(user: SearchUser): void {
    this.errorMessage.set(null);
    this.friendsService.cancelRequest(user.id).subscribe({
      next: () => {
        this.searchResults.set(
          this.searchResults().map(u => u.id === user.id ? { ...u, request_sent: false } : u),
        );
        this.successMessage.set('Friend request cancelled.');
      },
      error: err => {
        this.errorMessage.set(err?.error?.message ?? 'Failed to cancel request.');
      },
    });
  }

  acceptRequest(request: FriendRequestItem): void {
    this.errorMessage.set(null);
    this.friendsService.acceptRequest(request.id).subscribe({
      next: () => this.successMessage.set('Friend added!'),
      error: (err) => this.errorMessage.set(err?.error?.message ?? 'Failed to accept request.'),
    });
  }

  rejectRequest(request: FriendRequestItem): void {
    this.errorMessage.set(null);
    this.friendsService.rejectRequest(request.id).subscribe({
      error: (err) => this.errorMessage.set(err?.error?.message ?? 'Failed to reject request.'),
    });
  }

  askConfirmRemove(friend: FriendUser): void {
    this.previousFocusedElement = typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null;
    this.shouldFocusRoot = true;
    this.shouldFocusPrimaryAction = true;
    this.confirmRemoveFriend.set(friend);
  }

  confirmRemove(): void {
    const friend = this.confirmRemoveFriend();
    if (!friend) return;
    this.confirmRemoveFriend.set(null);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }

    this.errorMessage.set(null);
    this.friendsService.removeFriend(friend.id).subscribe({
      next: () => this.successMessage.set(`${friend.name} removed from your friends.`),
      error: (err) => this.errorMessage.set(err?.error?.message ?? 'Failed to remove friend.'),
    });
  }

  cancelRemove(): void {
    this.confirmRemoveFriend.set(null);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  isSendingTo(userId: string): boolean {
    return this.sendingRequestTo().includes(userId);
  }

  getIconUrl(iconPath: string | null | undefined): string {
    if (!iconPath) return '';
    return this.auth.getAssetUrl(iconPath);
  }

  onSearchIconError(userId: string): void {
    const cur = [...this.searchIconErrors()];
    if (!cur.includes(userId)) cur.push(userId);
    this.searchIconErrors.set(cur);
  }

  hasSearchIconError(userId: string): boolean {
    return this.searchIconErrors().includes(userId);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmRemoveFriend()) this.cancelRemove();
  }

  onConfirmModalKeydown(event: KeyboardEvent): void {
    if (!this.confirmRemoveFriend() || event.key !== 'Tab') return;
    const root = this.confirmDialog?.nativeElement;
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
}
