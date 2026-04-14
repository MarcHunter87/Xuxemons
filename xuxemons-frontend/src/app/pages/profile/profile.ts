import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../../core/services/auth';
import { XuxemonService } from '../../core/services/xuxemon.service';
import { TeamService } from '../../core/services/team.service';
import { Breadcrumb } from '../../core/components/breadcrumb/breadcrumb';
import { TrainerLvl } from '../../core/components/trainer-lvl/trainer-lvl';
import { Collection } from '../../core/components/collection/collection';
import { TotalBattles } from '../../core/components/total-battles/total-battles';
import type { Xuxemon } from '../../core/interfaces';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, Breadcrumb, TrainerLvl, Collection, TotalBattles],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, OnDestroy {
  user: User | null = null;
  user$ = inject(AuthService).user$;
  iconLoadError = false;
  bannerLoadError = false;
  isLoggingOut = signal(false);
  statsReady = signal(false);
  
  // Team management
  team = signal<any>(null);
  myXuxemons = signal<Xuxemon[]>([]);
  isSelectingForSlot = signal<number | null>(null);

  private sub: { unsubscribe: () => void } | null = null;
  private xuxemonService = inject(XuxemonService);
  private teamService = inject(TeamService);

  constructor(
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}


  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.sub = this.authService.user$.subscribe(u => {
      this.user = u;
      this.iconLoadError = false;
      this.bannerLoadError = false;
    });
    this.authService.refreshUserFromApi().subscribe(u => {
      if (u) this.statsReady.set(true);
    });
    this.loadTeam();
    this.loadMyXuxemons();
  }

  loadTeam(): void {
    this.teamService.getTeam().subscribe(t => this.team.set(t));
  }

  loadMyXuxemons(): void {
    this.xuxemonService.loadMyXuxemons();
    this.xuxemonService.myXuxemonsList.subscribe(list => {
      console.log('Loaded Xuxemons:', list); // Debug
      this.myXuxemons.set(list);
      this.cdr.detectChanges(); // Forzar detección de cambios
    });
  }

  openSelector(slot: number): void {
    this.isSelectingForSlot.set(slot);
    this.loadMyXuxemons(); // Recargar al abrir para asegurar datos frescos
  }

  closeSelector(): void {
    this.isSelectingForSlot.set(null);
  }

  selectForSlot(xuxemon: Xuxemon | null): void {
    const slot = this.isSelectingForSlot();
    if (slot !== null) {
      const adquiredId = xuxemon?.adquired_id;
      this.teamService.updateSlot(slot, adquiredId ? Number(adquiredId) : null).subscribe({
        next: () => {
          this.loadTeam();
          this.closeSelector();
        },
        error: (err) => {
          console.error('Error updating slot:', err);
          alert('Failed to update team slot. Error: ' + (err.message || 'Unknown error'));
        }
      });
    }
  }

  getSlotXuxemon(slot: number): any {
    if (!this.team()) return null;
    return this.team()[`slot${slot}`];
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
      next: () => { },
      error: () => {
        this.isLoggingOut.set(false);
        this.cdr.detectChanges();
      },
    });
  }
}
