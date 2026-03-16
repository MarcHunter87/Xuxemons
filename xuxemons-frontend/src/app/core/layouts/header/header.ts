import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header implements OnInit, OnDestroy {
  readonly menuOpen = signal(false);

  user: User | null = null;
  isAdmin = false;
  iconLoadError = false;
  iconUrl: string | null = null;
  displayName = 'Unknown';
  private sub!: Subscription;
  private router = inject(Router);

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.authService.user$.subscribe((user: User | null) => {
      this.user = user;
      this.isAdmin = user?.role === 'admin';
      this.iconLoadError = false;
      this.displayName = user?.id ?? 'Unknown';
      this.iconUrl = user?.icon_path
        ? this.authService.getAssetUrl(user.icon_path, user.updated_at)
        : null;
      this.cdr.markForCheck();
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.menuOpen.set(false));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}
