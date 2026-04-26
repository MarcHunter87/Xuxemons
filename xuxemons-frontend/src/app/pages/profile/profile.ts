import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService, User } from '../../core/services/auth';
import { Breadcrumb } from '../../core/components/breadcrumb/breadcrumb';
import { TrainerLvl } from '../../core/components/trainer-lvl/trainer-lvl';
import { Collection } from '../../core/components/collection/collection';
import { TotalBattles } from '../../core/components/total-battles/total-battles';
import { TeamService } from '../../core/services/team.service';
import { XuxemonService } from '../../core/services/xuxemon.service';
import type { Xuxemon } from '../../core/interfaces';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, Breadcrumb, TrainerLvl, Collection, TotalBattles],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, OnDestroy {
  private static readonly TEAM_SIZE = 6;

  user: User | null = null;
  user$ = inject(AuthService).user$;
  iconLoadError = false;
  bannerLoadError = false;
  isLoggingOut = signal(false);
  statsReady = signal(false);
  teamSlots = signal<Array<number | null>>(Array(Profile.TEAM_SIZE).fill(null));
  selectedTeamSlot = signal(0);
  myXuxemons = signal<Xuxemon[]>([]);
  isTeamBusy = signal(false);
  teamFeedback = signal<string | null>(null);
  private readonly subs = new Subscription();

  // Sirve para inyectar servicios de perfil
  constructor(
    private authService: AuthService,
    private teamService: TeamService,
    private xuxemonService: XuxemonService,
    private cdr: ChangeDetectorRef,
  ) {}


  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.subs.add(this.authService.user$.subscribe(u => {
      this.user = u;
      this.iconLoadError = false;
      this.bannerLoadError = false;
    }));
    this.subs.add(this.authService.refreshUserFromApi().subscribe(u => {
      if (u) this.statsReady.set(true);
    }));

    this.subs.add(this.xuxemonService.myXuxemonsList.subscribe((list) => {
      this.myXuxemons.set(list ?? []);
    }));

    void this.loadTeamBuilder();
  }

  // Sirve para obtener la URL del banner
  getBannerUrl(): string {
    if (this.bannerLoadError || !this.user?.banner_path) {
      return '/images/default_banner.webp';
    }
    return this.authService.getAssetUrl(this.user.banner_path, this.user.updated_at);
  }

  // Sirve para obtener la URL del icono
  getIconUrl(): string | null {
    return this.user?.icon_path && !this.iconLoadError
      ? this.authService.getAssetUrl(this.user.icon_path, this.user.updated_at)
      : null;
  }

  // Sirve para destruir el componente
  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async loadTeamBuilder(): Promise<void> {
    try {
      await this.xuxemonService.loadMyXuxemons();
      const team = await firstValueFrom(this.teamService.getTeam());
      this.teamSlots.set(this.mapTeamToSlots(team));
      this.teamFeedback.set(null);
    } catch {
      this.teamFeedback.set('Could not load your battle team right now.');
    }
  }

  getSlotLabel(index: number): string {
    return `Slot ${index + 1}`;
  }

  selectTeamSlot(index: number): void {
    if (index < 0 || index >= Profile.TEAM_SIZE) {
      return;
    }

    this.selectedTeamSlot.set(index);
  }

  getSlotXuxemon(index: number): Xuxemon | null {
    const adquiredId = this.teamSlots()[index];
    if (!adquiredId) {
      return null;
    }

    return this.myXuxemons().find((xuxemon) => xuxemon.adquired_id === adquiredId) ?? null;
  }

  async assignXuxemonToSelectedSlot(xuxemon: Xuxemon): Promise<void> {
    const adquiredId = xuxemon.adquired_id;
    if (!adquiredId || this.isTeamBusy()) {
      return;
    }

    const destinationIndex = this.selectedTeamSlot();
    const currentSlots = [...this.teamSlots()];
    const currentAtDestination = currentSlots[destinationIndex];
    const existingIndex = currentSlots.findIndex((id, idx) => id === adquiredId && idx !== destinationIndex);

    if (currentAtDestination === adquiredId) {
      this.teamFeedback.set(`${xuxemon.name} is already in ${this.getSlotLabel(destinationIndex)}.`);
      return;
    }

    currentSlots[destinationIndex] = adquiredId;
    if (existingIndex >= 0) {
      currentSlots[existingIndex] = currentAtDestination ?? null;
    }

    this.isTeamBusy.set(true);
    this.teamFeedback.set(null);

    try {
      await firstValueFrom(this.teamService.updateSlot(destinationIndex + 1, adquiredId));
      if (existingIndex >= 0) {
        await firstValueFrom(this.teamService.updateSlot(existingIndex + 1, currentAtDestination ?? null));
      }

      this.teamSlots.set(currentSlots);
      this.teamFeedback.set(existingIndex >= 0
        ? `${xuxemon.name} moved to ${this.getSlotLabel(destinationIndex)} and team order was updated.`
        : `${xuxemon.name} assigned to ${this.getSlotLabel(destinationIndex)}.`);
    } catch {
      this.teamFeedback.set('Could not save team slot. Try again.');
    } finally {
      this.isTeamBusy.set(false);
    }
  }

  async clearSelectedSlot(): Promise<void> {
    const index = this.selectedTeamSlot();
    const currentSlots = [...this.teamSlots()];
    const currentValue = currentSlots[index];

    if (!currentValue || this.isTeamBusy()) {
      return;
    }

    this.isTeamBusy.set(true);
    this.teamFeedback.set(null);

    try {
      await firstValueFrom(this.teamService.updateSlot(index + 1, null));
      currentSlots[index] = null;
      this.teamSlots.set(currentSlots);
      this.teamFeedback.set(`${this.getSlotLabel(index)} is now empty.`);
    } catch {
      this.teamFeedback.set('Could not clear this slot. Try again.');
    } finally {
      this.isTeamBusy.set(false);
    }
  }

  isSelectedSlot(index: number): boolean {
    return this.selectedTeamSlot() === index;
  }

  isXuxemonInTeam(xuxemon: Xuxemon): boolean {
    return !!xuxemon.adquired_id && this.teamSlots().includes(xuxemon.adquired_id);
  }

  getXuxemonStat(xuxemon: Xuxemon, stat: 'hp' | 'attack' | 'defense'): number {
    if (stat === 'hp') {
      return xuxemon.current_hp ?? xuxemon.hp ?? 0;
    }

    if (stat === 'attack') {
      return xuxemon.attack ?? 0;
    }

    return xuxemon.defense ?? 0;
  }

  getXuxemonStates(xuxemon: Xuxemon): string[] {
    const states = [
      xuxemon.statusEffect?.name,
      xuxemon.side_effect_1?.name,
      xuxemon.side_effect_2?.name,
      xuxemon.side_effect_3?.name,
    ].filter((state): state is string => !!state?.trim());

    return Array.from(new Set(states));
  }

  isTeamFeedbackError(): boolean {
    const feedback = this.teamFeedback();
    if (!feedback) {
      return false;
    }

    return /^could not\b/i.test(feedback.trim());
  }

  trackByXuxemon = (_: number, xuxemon: Xuxemon): number => xuxemon.adquired_id ?? xuxemon.id;

  private mapTeamToSlots(team: any): Array<number | null> {
    return [
      team?.slot_1_adquired_xuxemon_id,
      team?.slot_2_adquired_xuxemon_id,
      team?.slot_3_adquired_xuxemon_id,
      team?.slot_4_adquired_xuxemon_id,
      team?.slot_5_adquired_xuxemon_id,
      team?.slot_6_adquired_xuxemon_id,
    ].map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    });
  }

  // Sirve para cerrar sesión
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
