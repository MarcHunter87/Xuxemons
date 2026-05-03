import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TeamService } from '../../services/team.service';
import { XuxemonService } from '../../services/xuxemon.service';
import type { Xuxemon } from '../../interfaces';

@Component({
  selector: 'app-battle-team',
  imports: [CommonModule],
  templateUrl: './battle-team.html',
  styleUrl: './battle-team.css',
})
export class BattleTeam implements OnInit {
  private static readonly TEAM_SIZE = 6;
  readonly teamSlots = signal<Array<number | null>>(Array(BattleTeam.TEAM_SIZE).fill(null));
  readonly selectedTeamSlot = signal<number | null>(null);
  readonly myXuxemons = signal<Xuxemon[]>([]);
  readonly isTeamBusy = signal(false);
  readonly teamFeedback = signal<string | null>(null);
  readonly rosterVisible = signal(false);

  constructor(
    private readonly teamService: TeamService,
    private readonly xuxemonService: XuxemonService,
  ) {}

  // Sirve para inicializar el componente del battle team
  ngOnInit(): void {
    this.xuxemonService.myXuxemonsList.subscribe((list) => {
      this.myXuxemons.set(list ?? []);
      void this.pruneDeadFromTeamSlots();
    });
    void this.loadTeamBuilder();
  }

  // Sirve para cargar el roster y los slots del equipo desde backend
  async loadTeamBuilder(): Promise<void> {
    try {
      await this.xuxemonService.loadMyXuxemons();
      const team = await firstValueFrom(this.teamService.getTeam());
      this.teamSlots.set(this.mapTeamToSlots(team));
      await this.pruneDeadFromTeamSlots();
      this.teamFeedback.set(null);
    } catch {
      this.teamFeedback.set('Could not load your battle team right now.');
    }
  }

  // Sirve para obtener la etiqueta aria de cada slot
  getSlotLabel(index: number): string {
    return `Slot ${index + 1}`;
  }

  // Sirve para seleccionar el slot activo y mostrar la lista de asignación
  selectTeamSlot(index: number): void {
    if (index < 0 || index >= BattleTeam.TEAM_SIZE) {
      return;
    }
    if (this.selectedTeamSlot() === index && this.rosterVisible()) {
      this.clearSlotSelection();
      return;
    }
    this.selectedTeamSlot.set(index);
    this.rosterVisible.set(true);
  }

  // Sirve para deseleccionar el slot activo y ocultar la lista
  private clearSlotSelection(): void {
    this.selectedTeamSlot.set(null);
    this.rosterVisible.set(false);
  }

  // Sirve para obtener el xuxemon que ocupa un slot
  getSlotXuxemon(index: number): Xuxemon | null {
    const adquiredId = this.teamSlots()[index];
    if (!adquiredId) {
      return null;
    }
    const resolved = this.myXuxemons().find((xuxemon) => xuxemon.adquired_id === adquiredId) ?? null;
    if (!resolved || !this.isXuxemonBattleReady(resolved)) {
      return null;
    }
    return resolved;
  }

  // Sirve para filtrar roster dejando fuera los xuxemons ya asignados al team
  availableRosterXuxemons(): Xuxemon[] {
    const usedIds = new Set(this.teamSlots().filter((value): value is number => value != null));
    return this.myXuxemons().filter(
      (xuxemon) =>
        this.isXuxemonBattleReady(xuxemon)
        && (!xuxemon.adquired_id || !usedIds.has(xuxemon.adquired_id)),
    );
  }

  // Sirve para asignar un xuxemon al slot seleccionado
  async assignXuxemonToSelectedSlot(xuxemon: Xuxemon): Promise<void> {
    const adquiredId = xuxemon.adquired_id;
    const destinationIndex = this.selectedTeamSlot();
    if (!adquiredId || destinationIndex == null || this.isTeamBusy() || !this.isXuxemonBattleReady(xuxemon)) {
      return;
    }

    const currentSlots = [...this.teamSlots()];
    currentSlots[destinationIndex] = adquiredId;

    this.isTeamBusy.set(true);
    this.teamFeedback.set(null);
    try {
      await firstValueFrom(this.teamService.updateSlot(destinationIndex + 1, adquiredId));
      this.teamSlots.set(currentSlots);
      this.clearSlotSelection();
    } catch {
      this.teamFeedback.set('Could not save team slot. Try again.');
    } finally {
      this.isTeamBusy.set(false);
    }
  }

  // Sirve para vaciar el slot seleccionado y cerrar la lista de asignación
  async clearSelectedSlot(): Promise<void> {
    const index = this.selectedTeamSlot();
    if (index == null || this.isTeamBusy()) {
      return;
    }

    const currentSlots = [...this.teamSlots()];
    const currentValue = currentSlots[index];
    if (!currentValue) {
      this.clearSlotSelection();
      return;
    }

    this.isTeamBusy.set(true);
    this.teamFeedback.set(null);
    try {
      await firstValueFrom(this.teamService.updateSlot(index + 1, null));
      currentSlots[index] = null;
      this.teamSlots.set(currentSlots);
      this.clearSlotSelection();
    } catch {
      this.teamFeedback.set('Could not clear this slot. Try again.');
    } finally {
      this.isTeamBusy.set(false);
    }
  }

  // Sirve para revisar si un slot está marcado como seleccionado
  isSelectedSlot(index: number): boolean {
    return this.selectedTeamSlot() === index;
  }

  // Sirve para mostrar Clear Selected Slot solo cuando el slot seleccionado tiene xuxemon
  hasSelectedFilledSlot(): boolean {
    const selected = this.selectedTeamSlot();
    if (selected == null) return false;
    return this.getSlotXuxemon(selected) !== null;
  }

  // Sirve para leer stats y valores mostrados en badges numéricas
  getXuxemonStat(xuxemon: Xuxemon, stat: 'hp' | 'attack' | 'defense'): number {
    if (stat === 'hp') return xuxemon.current_hp ?? xuxemon.hp ?? 0;
    if (stat === 'attack') return xuxemon.attack ?? 0;
    return xuxemon.defense ?? 0;
  }

  isXuxemonBattleReady(xuxemon: Xuxemon): boolean {
    return this.getXuxemonStat(xuxemon, 'hp') > 0;
  }

  // Sirve para vaciar en backend los slots cuyo Xuxemon tiene 0 HP
  private async pruneDeadFromTeamSlots(): Promise<void> {
    if (this.isTeamBusy()) {
      return;
    }

    const roster = this.myXuxemons();
    if (roster.length === 0) {
      return;
    }

    const slots = [...this.teamSlots()];
    const toClear: number[] = [];

    for (let i = 0; i < slots.length; i++) {
      const id = slots[i];
      if (!id) {
        continue;
      }

      const xuxemon = roster.find((entry) => entry.adquired_id === id);
      const hp = xuxemon ? this.getXuxemonStat(xuxemon, 'hp') : 0;
      if (hp <= 0) {
        toClear.push(i);
      }
    }

    if (toClear.length === 0) {
      return;
    }

    this.isTeamBusy.set(true);
    try {
      for (const i of toClear) {
        await firstValueFrom(this.teamService.updateSlot(i + 1, null));
        slots[i] = null;
      }
      this.teamSlots.set(slots);
    } catch {
      this.teamFeedback.set('Could not update team after a faint. Clear slots manually if needed.');
    } finally {
      this.isTeamBusy.set(false);
    }
  }

  // Sirve para obtener estados/side effects únicos junto con su icono
  getXuxemonStates(xuxemon: Xuxemon): Array<{ name: string; iconUrl: string | null }> {
    return [
      { name: xuxemon.statusEffect?.name, iconUrl: xuxemon.statusEffect?.icon_url ?? null },
      { name: xuxemon.side_effect_1?.name, iconUrl: xuxemon.side_effect_1?.icon_url ?? null },
      { name: xuxemon.side_effect_2?.name, iconUrl: xuxemon.side_effect_2?.icon_url ?? null },
      { name: xuxemon.side_effect_3?.name, iconUrl: xuxemon.side_effect_3?.icon_url ?? null },
    ].filter((state): state is { name: string; iconUrl: string | null } => !!state.name?.trim());
  }

  // Sirve para resolver si el feedback actual es de error
  isTeamFeedbackError(): boolean {
    return this.teamFeedback()?.trim().toLowerCase().startsWith('could not') ?? false;
  }

  trackByXuxemon = (_: number, xuxemon: Xuxemon): number => xuxemon.adquired_id ?? xuxemon.id;

  // Sirve para mapear respuesta de team a slots internos
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
}
