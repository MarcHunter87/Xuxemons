import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
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
  user: User | null = null;
  isAdmin = false;
  iconLoadError = false;
  iconUrl: string | null = null;
  displayName = 'Unknown';
  private sub!: Subscription;

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
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
  }
}
