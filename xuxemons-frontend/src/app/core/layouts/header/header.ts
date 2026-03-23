import { ChangeDetectionStrategy, Component, HostListener, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class Header {
  menuOpen = false;
  user: User | null = null;
  iconLoadError = false;
  iconUrl: string | null = null;
  displayName = 'Unknown';

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    this.auth.user$.pipe(takeUntilDestroyed()).subscribe((u) => {
      this.user = u;
      this.iconLoadError = false;
      this.displayName = u?.id ?? 'Unknown';
      this.iconUrl = u?.icon_path ? this.auth.getAssetUrl(u.icon_path, u.updated_at) : null;
      if (this.isBrowser) {
        if (u) this.auth.refreshGachaTickets();
        else this.auth.setGachaTicketCount(0);
      }
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.menuOpen = false;
        if (this.isBrowser && this.user) this.auth.refreshGachaTickets();
      });
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen = false;
  }
}
