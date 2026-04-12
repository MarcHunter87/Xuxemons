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
  private readonly cardAnimationMs = 180;
  private auth = inject(AuthService);
  private friendsService = inject(FriendsService);
  private subs = new Subscription();
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];
  private friendsInitialized = false;
  private pendingRequestsInitialized = false;

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
  enteringFriendIds = signal<string[]>([]);
  exitingFriendIds = signal<string[]>([]);
  enteringRequestIds = signal<number[]>([]);
  exitingRequestIds = signal<number[]>([]);
  busyRequestIds = signal<number[]>([]);
  busyFriendIds = signal<string[]>([]);

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
        const previousIds = new Set(this.friends().map(friend => friend.id));
        this.friends.set(f);
        this.animateFriendEntries(previousIds, f);

        // If a user became a friend, mark as friend and clear request flags
        if (this.searchResults().length > 0) {
          const friendIds = f.map(ff => ff.id);
          this.searchResults.set(
            this.searchResults().map(u => friendIds.includes(u.id)
              ? { ...u, is_friend: true, request_received: false, request_sent: false }
              : { ...u, is_friend: false },
            ),
          );
        }
      }),
    );
    this.subs.add(
      this.friendsService.pendingRequests.subscribe(r => {
        const previousIds = new Set(this.pendingRequests().map(request => request.id));
        this.pendingRequests.set(r);
        this.animateRequestEntries(previousIds, r);

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
    this.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
  }

  private scheduleTimeout(callback: () => void, delay: number): void {
    const timeoutId = setTimeout(() => {
      this.timeoutIds = this.timeoutIds.filter(id => id !== timeoutId);
      callback();
    }, delay);
    this.timeoutIds.push(timeoutId);
  }

  private addFriendIds(target: ReturnType<typeof signal<string[]>>, ids: string[]): void {
    if (ids.length === 0) return;
    target.set(Array.from(new Set([...target(), ...ids])));
  }

  private removeFriendIds(target: ReturnType<typeof signal<string[]>>, ids: string[]): void {
    if (ids.length === 0) return;
    const idsSet = new Set(ids);
    target.set(target().filter(id => !idsSet.has(id)));
  }

  private addRequestIds(target: ReturnType<typeof signal<number[]>>, ids: number[]): void {
    if (ids.length === 0) return;
    target.set(Array.from(new Set([...target(), ...ids])));
  }

  private removeRequestIds(target: ReturnType<typeof signal<number[]>>, ids: number[]): void {
    if (ids.length === 0) return;
    const idsSet = new Set(ids);
    target.set(target().filter(id => !idsSet.has(id)));
  }

  private animateFriendEntries(previousIds: Set<string>, nextFriends: FriendUser[]): void {
    const shouldAnimateEntries = this.friendsInitialized && this.animationsEnabled;
    this.friendsInitialized = true;
    if (!shouldAnimateEntries) return;

    const enteringIds = nextFriends
      .map(friend => friend.id)
      .filter(id => !previousIds.has(id));

    this.addFriendIds(this.enteringFriendIds, enteringIds);
    this.scheduleTimeout(() => this.removeFriendIds(this.enteringFriendIds, enteringIds), this.cardAnimationMs);
  }

  private animateRequestEntries(previousIds: Set<number>, nextRequests: FriendRequestItem[]): void {
    const shouldAnimateEntries = this.pendingRequestsInitialized && this.animationsEnabled;
    this.pendingRequestsInitialized = true;
    if (!shouldAnimateEntries) return;

    const enteringIds = nextRequests
      .map(request => request.id)
      .filter(id => !previousIds.has(id));

    this.addRequestIds(this.enteringRequestIds, enteringIds);
    this.scheduleTimeout(() => this.removeRequestIds(this.enteringRequestIds, enteringIds), this.cardAnimationMs);
  }

  private removeVisibleRequest(requestId: number): void {
    this.pendingRequests.set(this.pendingRequests().filter(request => request.id !== requestId));
  }

  private removeVisibleFriend(friendId: string): void {
    this.friends.set(this.friends().filter(friend => friend.id !== friendId));
  }

  private animateRequestRemoval(requestId: number, callback: () => void): void {
    this.addRequestIds(this.busyRequestIds, [requestId]);
    if (!this.animationsEnabled) {
      this.removeVisibleRequest(requestId);
      callback();
      return;
    }

    this.addRequestIds(this.exitingRequestIds, [requestId]);
    this.scheduleTimeout(() => {
      this.removeRequestIds(this.exitingRequestIds, [requestId]);
      this.removeVisibleRequest(requestId);
      callback();
    }, this.cardAnimationMs);
  }

  private animateFriendRemoval(friendId: string, callback: () => void): void {
    this.addFriendIds(this.busyFriendIds, [friendId]);
    if (!this.animationsEnabled) {
      this.removeVisibleFriend(friendId);
      callback();
      return;
    }

    this.addFriendIds(this.exitingFriendIds, [friendId]);
    this.scheduleTimeout(() => {
      this.removeFriendIds(this.exitingFriendIds, [friendId]);
      this.removeVisibleFriend(friendId);
      callback();
    }, this.cardAnimationMs);
  }

  isFriendEntering(friendId: string): boolean {
    return this.enteringFriendIds().includes(friendId);
  }

  isFriendExiting(friendId: string): boolean {
    return this.exitingFriendIds().includes(friendId);
  }

  isRequestEntering(requestId: number): boolean {
    return this.enteringRequestIds().includes(requestId);
  }

  isRequestExiting(requestId: number): boolean {
    return this.exitingRequestIds().includes(requestId);
  }

  isRequestBusy(requestId: number): boolean {
    return this.busyRequestIds().includes(requestId);
  }

  isFriendBusy(friendId: string): boolean {
    return this.busyFriendIds().includes(friendId);
  }

  private reloadAll(): void {
    this.friendsService.loadFriends();
    this.friendsService.loadPendingRequests();
    const q = this.searchControl.value ?? '';
    if (q.length >= 3) {
      this.friendsService.searchUsers(q).subscribe({
        next: results => this.searchResults.set(results),
      });
    }
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
      error: () => {
        const cur = this.sendingRequestTo().filter(id => id !== user.id);
        this.sendingRequestTo.set(cur);
        this.reloadAll();
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
      error: () => this.reloadAll(),
    });
  }

  acceptRequest(request: FriendRequestItem): void {
    if (this.isRequestBusy(request.id)) return;
    this.errorMessage.set(null);
    this.animateRequestRemoval(request.id, () => {
      this.friendsService.acceptRequest(request.id).subscribe({
        next: () => {
          this.removeRequestIds(this.busyRequestIds, [request.id]);
          this.successMessage.set('Friend added!');
        },
        error: () => {
          this.removeRequestIds(this.busyRequestIds, [request.id]);
          this.reloadAll();
        },
      });
    });
  }

  rejectRequest(request: FriendRequestItem): void {
    if (this.isRequestBusy(request.id)) return;
    this.errorMessage.set(null);
    this.animateRequestRemoval(request.id, () => {
      this.friendsService.rejectRequest(request.id).subscribe({
        next: () => this.removeRequestIds(this.busyRequestIds, [request.id]),
        error: () => {
          this.removeRequestIds(this.busyRequestIds, [request.id]);
          this.reloadAll();
        },
      });
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
    this.animateFriendRemoval(friend.id, () => {
      this.friendsService.removeFriend(friend.id).subscribe({
        next: () => {
          this.removeFriendIds(this.busyFriendIds, [friend.id]);
        },
        error: () => {
          this.removeFriendIds(this.busyFriendIds, [friend.id]);
          this.reloadAll();
        },
      });
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

  getFriendById(userId: string): FriendUser | undefined {
    return this.friends().find(f => f.id === userId);
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
