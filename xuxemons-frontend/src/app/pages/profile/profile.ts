import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../../core/services/auth';
import { Breadcrumb } from '../../core/components/breadcrumb/breadcrumb';
import { TrainerLvl } from '../../core/components/trainer-lvl/trainer-lvl';
import { Collection } from '../../core/components/collection/collection';
import { TotalBattles } from '../../core/components/total-battles/total-battles';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, Breadcrumb, TrainerLvl, Collection, TotalBattles],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, OnDestroy {
  user: User | null = null;
  iconLoadError = false;
  bannerLoadError = false;
  isLoggingOut = signal(false);
  private sub: { unsubscribe: () => void } | null = null;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.sub = this.authService.user$.subscribe(u => {
      this.user = u;
      this.iconLoadError = false;
      this.bannerLoadError = false;
    });
  }

  getBannerUrl(): string {
    if (this.bannerLoadError || !this.user?.banner_path) {
      return '/images/default_banner.png';
    }
    return this.authService.getAssetUrl(this.user.banner_path, this.user.updated_at);
  }

  getIconUrl(): string | null {
    return this.user?.icon_path && !this.iconLoadError
      ? this.authService.getAssetUrl(this.user.icon_path, this.user.updated_at)
      : null;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout(): void {
    this.isLoggingOut.set(true);
    this.authService.logout().subscribe({
      next: () => {},
      error: () => {
        this.isLoggingOut.set(false);
        this.cdr.detectChanges();
      },
    });
  }
}
