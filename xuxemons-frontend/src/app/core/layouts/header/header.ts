import { ChangeDetectionStrategy, Component, HostListener, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth';
import { FriendsService } from '../../services/friends.service';

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
  readonly friendsService = inject(FriendsService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Sirve para suscribirse al usuario y a la navegación
  constructor() {
    this.auth.user$.pipe(takeUntilDestroyed()).subscribe((u) => {
      this.user = u;
      this.iconLoadError = false;
      this.displayName = u?.id ?? 'Unknown';
      this.iconUrl = u?.icon_path ? this.auth.getAssetUrl(u.icon_path, u.updated_at) : null;
      if (this.isBrowser) {
        if (u) {
          this.auth.refreshGachaTickets();
          this.friendsService.loadPendingRequests();
        } else {
          this.auth.setGachaTicketCount(0);
        }
      }
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        this.menuOpen = false;
        if (this.isBrowser && this.user) {
          this.auth.refreshGachaTickets();
          this.friendsService.loadPendingRequests();
        }
      });
  }

  // Sirve para alternar el menú
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  // Sirve para cerrar el menú
  closeMenu(): void {
    this.menuOpen = false;
  }

  // Sirve para manejar la tecla Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen = false;
  }
}
