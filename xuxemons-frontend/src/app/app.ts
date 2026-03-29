import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './core/layouts/header/header';
import { Footer } from './core/layouts/footer/footer';
import { Breadcrumb } from './core/components/breadcrumb/breadcrumb';
import { DailyNotiModal } from './core/components/daily-noti-modal/daily-noti-modal';
import { AuthService } from './core/services/auth';
import type { DailyRewardNotification } from './core/interfaces';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, Breadcrumb, DailyNotiModal],
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  protected readonly showLayout = signal(true);
  protected readonly showTopBreadcrumb = signal(true);
  protected readonly isProfilePage = signal(false);
  protected readonly showDailyRewardsModal = signal(false);
  protected readonly pendingDailyRewards = signal<DailyRewardNotification | null>(null);
  private sub: { unsubscribe: () => void } | null = null;
  private isCheckingPendingDailyRewards = false;

  constructor(private router: Router, private authService: AuthService) { }

  private updateShowLayout(): void {
    const url = this.router.url.split('?')[0];
    this.showLayout.set(url !== '/login' && url !== '/register');
    this.showTopBreadcrumb.set(url !== '/profile');
    this.isProfilePage.set(url === '/profile');
  }

  ngOnInit(): void {
    this.updateShowLayout();
    this.checkPendingDailyRewards();

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

  private hasAnyDailyRewards(notification: DailyRewardNotification): boolean {
    const gachaQty = notification.gacha_ticket?.quantity ?? 0;
    const itemCount = notification.items?.length ?? 0;
    return gachaQty > 0 || itemCount > 0;
  }
}
