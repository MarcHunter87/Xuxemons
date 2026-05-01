import { ChangeDetectionStrategy, Component, HostListener, PLATFORM_ID, inject, signal } from '@angular/core';
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
  readonly pendingFriendCount = signal(0);

  readonly auth = inject(AuthService);
  readonly friendsService = inject(FriendsService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Sirve para diferir refrescos globales y evitar cambios durante el mismo ciclo de detección.
  private scheduleHeaderSync(): void {
    if (!this.isBrowser || !this.user) {
      return;
    }

    setTimeout(() => {
      if (!this.user) {
        return;
      }

      this.auth.refreshGachaTickets();
      this.friendsService.loadPendingRequests();
    }, 0);
  }

  // Sirve para aplicar de forma consistente el usuario visible del header y sus derivados.
  private applyHeaderUserState(user: User | null): void {
    this.user = user;
    this.iconLoadError = false;
    this.displayName = user?.id ?? 'Unknown';
    this.iconUrl = user?.icon_path ? this.auth.getAssetUrl(user.icon_path, user.updated_at) : null;
  }

  // Sirve para suscribirse al usuario y a la navegación
  constructor() {
    this.applyHeaderUserState(this.auth.getUser());

    this.friendsService.pendingCount.pipe(takeUntilDestroyed()).subscribe((count) => {
      this.pendingFriendCount.set(count);
    });

    this.auth.user$.pipe(takeUntilDestroyed()).subscribe((u) => {
      this.applyHeaderUserState(u);
      if (this.isBrowser) {
        if (u) {
          this.scheduleHeaderSync();
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
          this.scheduleHeaderSync();
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
