import { Component, signal, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { filter, interval, Subscription } from 'rxjs';
import { Header } from './core/layouts/header/header';
import { Footer } from './core/layouts/footer/footer';
import { Breadcrumb } from './core/components/breadcrumb/breadcrumb';
import { DailyNotiModal } from './core/components/daily-noti-modal/daily-noti-modal';
import { FriendRequestNotiModal } from './core/components/friend-request-noti-modal/friend-request-noti-modal';
import { AuthService } from './core/services/auth';
import { FriendsService } from './core/services/friends.service';
import type { DailyRewardNotification, FriendRequestItem } from './core/interfaces';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, Breadcrumb, DailyNotiModal, FriendRequestNotiModal],
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  protected readonly showLayout = signal(true);
  protected readonly showFooter = signal(true);
  protected readonly showTopBreadcrumb = signal(true);
  protected readonly isProfilePage = signal(false);
  protected readonly isBattlePage = signal(false);
  protected readonly showDailyRewardsModal = signal(false);
  protected readonly pendingDailyRewards = signal<DailyRewardNotification | null>(null);
  protected readonly showFriendRequestModal = signal(false);
  protected readonly pendingFriendRequests = signal<FriendRequestItem[]>([]);
  private dismissedFriendRequestIds: Record<string, boolean> = {};
  private sub: { unsubscribe: () => void } | null = null;
  private friendSub: { unsubscribe: () => void } | null = null;
  private periodicSyncSub: Subscription | null = null;
  private isCheckingPendingDailyRewards = false;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private router: Router, private authService: AuthService, private friendsService: FriendsService) { }

  private updateShowLayout(): void {
    const url = this.router.url.split('?')[0];
    this.showLayout.set(url !== '/login' && url !== '/register');
    this.showFooter.set(url !== '/login' && url !== '/register' && !url.startsWith('/battle'));
    this.showTopBreadcrumb.set(url !== '/profile' && !url.startsWith('/battle'));
    this.isProfilePage.set(url === '/profile');
    this.isBattlePage.set(url.startsWith('/battle'));
  }

  ngOnInit(): void {
    this.updateShowLayout();
    this.checkPendingDailyRewards();

    this.friendSub = this.friendsService.pendingRequests.subscribe(requests => {
      this.pendingFriendRequests.set(requests);
      const hasUndismissed = requests.some(r => !this.dismissedFriendRequestIds[String(r.id)]);
      if (requests.length > 0 && hasUndismissed && !this.showFriendRequestModal()) {
        this.showFriendRequestModal.set(true);
      }
    });

    if (this.isBrowser) {
      this.periodicSyncSub = interval(15_000).subscribe(() => {
        if (this.authService.getUser()) {
          this.friendsService.loadFriends();
          this.friendsService.loadPendingRequests();
          this.checkPendingDailyRewards();
        }
      });
    }

    this.sub = this.router.events.pipe(
      filter(e => e.constructor.name === 'NavigationEnd')
    ).subscribe(() => {
      this.updateShowLayout();
      this.checkPendingDailyRewards();
      if (this.showLayout()) {
        setTimeout(() => {
          if (typeof document !== 'undefined') {
            const b = document.body;
            b.setAttribute('tabindex', '-1');
            b.focus();
            b.removeAttribute('tabindex');
          }
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.friendSub?.unsubscribe();
    this.periodicSyncSub?.unsubscribe();
  }

  onCloseDailyRewardsModal(): void {
    const pending = this.pendingDailyRewards();

    this.showDailyRewardsModal.set(false);
    this.pendingDailyRewards.set(null);

    if (!pending) {
      return;
    }

    this.authService.acknowledgeDailyRewardNotification(pending.id).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  private checkPendingDailyRewards(): void {
    const user = this.authService.getUser();

    if (!user || user.role !== 'player' || this.isCheckingPendingDailyRewards || this.showDailyRewardsModal()) {
      return;
    }

    this.isCheckingPendingDailyRewards = true;

    this.authService.getPendingDailyRewardNotification().subscribe({
      next: (pending) => {
        if (pending && this.hasAnyDailyRewards(pending)) {
          this.pendingDailyRewards.set(pending);
          this.showDailyRewardsModal.set(true);
        }
        this.isCheckingPendingDailyRewards = false;
      },
      error: () => {
        this.isCheckingPendingDailyRewards = false;
      }
    });
  }

  onCloseFriendRequestModal(): void {
    const pending = this.pendingFriendRequests();
    pending.forEach(r => { this.dismissedFriendRequestIds[String(r.id)] = true; });
    this.showFriendRequestModal.set(false);
  }

  onAcceptFriendRequest(req: FriendRequestItem): void {
    this.friendsService.acceptRequest(req.id).subscribe({
      next: () => {
        delete this.dismissedFriendRequestIds[String(req.id)];
        if (this.pendingFriendRequests().length === 0) {
          this.showFriendRequestModal.set(false);
        }
      },
    });
  }

  onRejectFriendRequest(req: FriendRequestItem): void {
    this.friendsService.rejectRequest(req.id).subscribe({
      next: () => {
        delete this.dismissedFriendRequestIds[String(req.id)];
        if (this.pendingFriendRequests().length === 0) {
          this.showFriendRequestModal.set(false);
        }
      },
    });
  }

  private hasAnyDailyRewards(notification: DailyRewardNotification): boolean {
    const gachaQty = notification.gacha_ticket?.quantity ?? 0;
    const itemCount = notification.items?.length ?? 0;
    return gachaQty > 0 || itemCount > 0;
  }
}
