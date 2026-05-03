import { take } from 'rxjs/operators';
import { Component, OnDestroy, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener, inject, signal, PLATFORM_ID, ChangeDetectorRef, NgZone, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription } from 'rxjs';
import { BattleService } from '../../core/services/battle.service';
import { XuxemonService } from '../../core/services/xuxemon.service';
import { TeamService } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth';
import { InventoryService } from '../../core/services/inventory.service';
import { BattleFooter } from '../../core/components/battle-footer/battle-footer';
import { BattleVictoryModal } from '../../core/components/modals/battle-victory-modal/battle-victory-modal';
import { BattleStealModal } from '../../core/components/modals/battle-steal-modal/battle-steal-modal';
import { BattleRunConfirmModal } from '../../core/components/modals/battle-run-confirm-modal/battle-run-confirm-modal';
import { BattleRunawayResultModal } from '../../core/components/modals/battle-runaway-result-modal/battle-runaway-result-modal';
import type { InventoryItem, UseItemResponseData, Xuxemon } from '../../core/interfaces';

type BattleMenu = 'attacks' | 'bag' | 'bag-target' | 'switch' | null;
type BattleLogSource = 'player' | 'opponent' | 'system';
type AttackVisualType = 'speed' | 'technical' | 'power' | 'speed-special' | 'technical-special' | 'power-special' | 'neutral';
type AttackAnimationDescriptor = {
  name?: string;
  dmg?: number;
  status_chance?: number | null;
  statusEffect?: {
    name: string;
    icon_url: string;
  };
};
interface BattleLogEntry { text: string; source: BattleLogSource; }

function normalizedStatusName(statusName: string | undefined | null): string {
  return statusName?.trim().toLowerCase() ?? '';
}

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [
    CommonModule,
    BattleFooter,
    BattleVictoryModal,
    BattleStealModal,
    BattleRunConfirmModal,
    BattleRunawayResultModal,
  ],
  templateUrl: './battle.html',
  styleUrl: './battle.css',
  encapsulation: ViewEncapsulation.None,
})
export class Battle implements OnInit, OnDestroy, AfterViewInit {
  readonly vm = this;

  // Sirve para comparar IDs del backend/UI sin depender del tipo (number/string).
  private sameId(left: unknown, right: unknown): boolean {
    if (left === null || left === undefined || right === null || right === undefined) {
      return false;
    }

    return String(left) === String(right);
  }

  private readonly bagPageSize = 2;
  private readonly supportedBattleEffectTypes = new Set<InventoryItem['effect_type']>([
    'Heal',
    'DMG Up',
    'Defense Up',
    'Apply Status Effects',
    'Remove Status Effects',
  ]);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private battleService = inject(BattleService);
  private xuxemonService = inject(XuxemonService);
  private teamService = inject(TeamService);
  private auth = inject(AuthService);
  private inventoryService = inject(InventoryService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private subs = new Subscription();
  private navGuardSubject: Subject<boolean> | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private battleEventSource: EventSource | null = null;
  private streamBootstrapTimeout: ReturnType<typeof setTimeout> | null = null;
  private battleCalloutTimeout: ReturnType<typeof setTimeout> | null = null;
  private inactiveBattleRedirectTimeout: ReturnType<typeof setTimeout> | null = null;
  private diceLandingTimeout: ReturnType<typeof setTimeout> | null = null;
  private diceOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
  private queuedAttackLungeTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingBarsSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerAttackTimeout: ReturnType<typeof setTimeout> | null = null;
  private opponentAttackTimeout: ReturnType<typeof setTimeout> | null = null;
  private attackTrailTimeout: ReturnType<typeof setTimeout> | null = null;
  private impactBurstTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerHitTimeout: ReturnType<typeof setTimeout> | null = null;
  private opponentHitTimeout: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('playerSprite') playerSprite?: ElementRef<HTMLDivElement>;
  @ViewChild('opponentSprite') opponentSprite?: ElementRef<HTMLDivElement>;
  @ViewChild('diceOverlay') diceOverlay?: ElementRef<HTMLDivElement>;
  @ViewChild('diceContainer') diceContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('diceCube') diceCube?: ElementRef<HTMLDivElement>;
  private playerFaintTimeout: ReturnType<typeof setTimeout> | null = null;
  private opponentFaintTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerSpriteAnimation: Animation | null = null;
  private opponentSpriteAnimation: Animation | null = null;
  private diceContainerAnimation: Animation | null = null;
  private diceCubeAnimation: Animation | null = null;
  private teamIds: number[] = [];
  private disconnectForfeitSent = false;
  private bypassDeactivateGuard = false;
  private lastBattleAnimationKey = '';
  private readonly diceLandingDurationMs = 430;
  private readonly diceOverlayDurationMs = 980;

  // Sirve para reactivar el polling cuando la pestaña vuelve a estar visible y no hay stream SSE.
  private readonly handleVisibilityChange = () => {
    if (this.battleEventSource || !this.isBrowser) {
      return;
    }

    this.restartPolling();
  };

  // Sirve para enviar la rendición automática al cerrar o recargar la página durante un combate enlazado.
  private readonly handlePageExit = (event: PageTransitionEvent | BeforeUnloadEvent) => {
    if ('persisted' in event && event.persisted) {
      return;
    }

    this.autoForfeitOnExit();
  };

  @ViewChild('battleMusic') battleMusic?: ElementRef<HTMLAudioElement>;
  @ViewChild('battleArena') battleArena?: ElementRef<HTMLDivElement>;

  private battleArenaLayoutResizeObserver: ResizeObserver | null = null;


  battleId = signal<number | null>(null);
  isPractice = signal(false);
  battleData = signal<any>(null);
  myXuxemons = signal<Xuxemon[]>([]);
  opponentTeam = signal<Xuxemon[]>([]);
  team = signal<any>(null);

  selectedXuxemon = signal<Xuxemon | null>(null);
  opponentXuxemon = signal<Xuxemon | null>(null);
  selectedBattleItem = signal<InventoryItem | null>(null);

  battleStatus = signal<'selecting' | 'ready' | 'animating' | 'finished'>('selecting');
  currentTurn = signal<'player' | 'opponent'>('player');
  currentSubMenu = signal<BattleMenu>(null);
  forcedSwitch = signal(false);

  playerHP = signal(100);
  playerMaxHP = signal(100);
  opponentHP = signal(100);
  opponentMaxHP = signal(100);

  diceValue = signal<number | null>(null);
  isDiceOverlayVisible = signal(false);
  isDiceRolling = signal(false);
  diceOutcomeTone = signal<'low' | 'mid' | 'high' | null>(null);
  // TAREA 3: attackVisualType siempre 'neutral' — misma animación para todos los ataques.
  attackVisualType = signal<AttackVisualType>('neutral');
  isPlayerAttacking = signal(false);
  isOpponentAttacking = signal(false);
  activeAttackTrail = signal<'player' | 'opponent' | null>(null);
  activeImpactBurst = signal<'player' | 'opponent' | null>(null);
  isPlayerHit = signal(false);
  isOpponentHit = signal(false);
  isPlayerFainting = signal(false);
  isOpponentFainting = signal(false);
  showConfetti = signal(false);
  showVictoryModal = signal(false);
  showStealModal = signal(false);
  showRunConfirmModal = signal(false);
  showRunawayResultModal = signal(false);
  realtimeStatus = signal<'live' | 'syncing'>('syncing');
  battleCallout = signal<{ text: string; tone: 'buff' | 'nerf' | 'neutral' } | null>(null);
  isSubmittingBattleResult = signal(false);
  isSubmittingRun = signal(false);
  runawayResultMessage = signal('');

  battleLog = signal<BattleLogEntry[]>([]);
  myItems = signal<InventoryItem[]>([]);
  bagPage = signal(0);
  bagTargetPage = signal(0);
  switchPage = signal(0);
  stealOptions = signal<Xuxemon[]>([]);
  stolenXuxemon = signal<Xuxemon | null>(null);

  playerTrainerName = signal('');
  playerTrainerLevel = signal(1);
  playerTrainerIcon = signal('');
  opponentTrainerName = signal('');
  opponentTrainerLevel = signal(1);
  opponentTrainerIcon = signal('');

  // Sirve para refrescar estadísticas del usuario al terminar el combate.
  private refreshAuthenticatedUserStats(): void {
    this.subs.add(this.auth.refreshUserFromApi().pipe(take(1)).subscribe());
  }

  // Sirve para iniciar la música cuando la vista ya está montada.
  ngAfterViewInit(): void {
    this.startBattleMusic();
  }


  // Sirve para abrir la confirmación de huida con Escape cuando no hay otro modal activo.
  @HostListener('document:keydown', ['$event'])
  onBattleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    if (
      this.showVictoryModal() ||
      this.showStealModal() ||
      this.showRunawayResultModal() ||
      this.showRunConfirmModal() ||
      this.isDiceOverlayVisible()
    ) {
      return;
    }
    this.runAway();
  }

  // Sirve para inicializar listeners, datos de combate e inventario.
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const user = this.auth.getUser();

    if (user) {
      this.playerTrainerName.set(user.name);
      this.playerTrainerLevel.set(user.level || 1);
      this.playerTrainerIcon.set(this.auth.getAssetUrl(user.icon_path || ''));
    }

    if (!id) {
      this.router.navigate(['/friends']);
      return;
    }

    this.isPractice.set(id === 'practice');
    this.battleId.set(+id);
    this.startBattleSync();

    if (this.isBrowser) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('pagehide', this.handlePageExit);
      window.addEventListener('beforeunload', this.handlePageExit);
    }

    this.loadTeamAndXuxemons();
    this.inventoryService.loadInventory();
    this.loadMyItems();
  }

  // Sirve para limpiar listeners, timeouts y animaciones al destruir la vista.
  ngOnDestroy(): void {
    if (this.isBrowser) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('pagehide', this.handlePageExit);
      window.removeEventListener('beforeunload', this.handlePageExit);
    }

    if (this.battleCalloutTimeout) {
      clearTimeout(this.battleCalloutTimeout);
      this.battleCalloutTimeout = null;
    }
    if (this.inactiveBattleRedirectTimeout) {
      clearTimeout(this.inactiveBattleRedirectTimeout);
      this.inactiveBattleRedirectTimeout = null;
    }

    if (this.diceLandingTimeout) {
      clearTimeout(this.diceLandingTimeout);
      this.diceLandingTimeout = null;
    }
    if (this.diceOverlayTimeout) {
      clearTimeout(this.diceOverlayTimeout);
      this.diceOverlayTimeout = null;
    }
    if (this.queuedAttackLungeTimeout) {
      clearTimeout(this.queuedAttackLungeTimeout);
      this.queuedAttackLungeTimeout = null;
    }
    if (this.pendingBarsSyncTimeout) {
      clearTimeout(this.pendingBarsSyncTimeout);
      this.pendingBarsSyncTimeout = null;
    }
    if (this.playerAttackTimeout) {
      clearTimeout(this.playerAttackTimeout);
      this.playerAttackTimeout = null;
    }
    if (this.opponentAttackTimeout) {
      clearTimeout(this.opponentAttackTimeout);
      this.opponentAttackTimeout = null;
    }
    if (this.attackTrailTimeout) {
      clearTimeout(this.attackTrailTimeout);
      this.attackTrailTimeout = null;
    }
    if (this.impactBurstTimeout) {
      clearTimeout(this.impactBurstTimeout);
      this.impactBurstTimeout = null;
    }
    if (this.playerHitTimeout) {
      clearTimeout(this.playerHitTimeout);
      this.playerHitTimeout = null;
    }
    if (this.opponentHitTimeout) {
      clearTimeout(this.opponentHitTimeout);
      this.opponentHitTimeout = null;
    }
    if (this.playerFaintTimeout) {
      clearTimeout(this.playerFaintTimeout);
      this.playerFaintTimeout = null;
    }
    if (this.opponentFaintTimeout) {
      clearTimeout(this.opponentFaintTimeout);
      this.opponentFaintTimeout = null;
    }
    this.playerSpriteAnimation?.cancel();
    this.playerSpriteAnimation = null;
    this.opponentSpriteAnimation?.cancel();
    this.opponentSpriteAnimation = null;
    this.diceContainerAnimation?.cancel();
    this.diceContainerAnimation = null;
    this.diceCubeAnimation?.cancel();
    this.diceCubeAnimation = null;

    this.stopBattleSync();
    this.stopBattleMusic();
    this.subs.unsubscribe();
  }

  // Sirve para mantener el estado del combate sincronizado en tiempo real o por polling.
  startBattleSync(): void {
    this.loadBattleData();

    if (this.openBattleStream()) {
      return;
    }

    this.startPolling();
  }

  // Sirve para activar sincronización periódica cuando no hay stream disponible.
  startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    this.realtimeStatus.set('syncing');
    this.pollingInterval = setInterval(() => {
      if (!this.isPractice() && this.battleStatus() !== 'animating') {
        this.loadBattleData();
      }
    }, this.getPollingIntervalMs());
  }

  // Sirve para hidratar el estado local con el snapshot actual del backend.
  loadBattleData(): void {
    if (!this.battleId()) {
      return;
    }

    this.subs.add(
      this.battleService.getBattle(this.battleId()!).subscribe((data: any) => {
        const wasFinished = this.battleStatus() === 'finished';
        this.applyBattleSnapshot(data);
        this.startBattleMusic();

        if (data.winner_id && !wasFinished) {
          this.handleExternallyFinishedBattle(data);
        }
      }, (error) => {
        const response = error?.error;
        const status = String(response?.status ?? '').toLowerCase();
        if (status === 'pending' || status === 'rejected' || status === 'completed' || status === 'finished') {
          this.battleData.set({
            ...this.battleData(),
            ...response,
            status,
          });
          this.currentSubMenu.set(null);
          this.selectedBattleItem.set(null);
          this.battleStatus.set(status === 'completed' || status === 'finished' ? 'finished' : 'selecting');
          this.addLog(response?.message ?? 'Battle is not active.', 'system');
          this.scheduleInactiveBattleExit();
        }
      }),
    );
  }

  // Sirve para mantener la bolsa de combate filtrada y paginada.
  loadMyItems(): void {
    this.subs.add(
      this.inventoryService.items.subscribe((items) => {
        const battleBagItems = items.filter((item) => this.shouldDisplayInBattleBag(item));
        this.myItems.set(battleBagItems);

        const maxPage = Math.max(0, this.getBagTotalPages(battleBagItems.length) - 1);
        if (this.bagPage() > maxPage) {
          this.bagPage.set(maxPage);
        }
      }),
    );
  }

  // Sirve para cargar el equipo del jugador desde el backend y disparar la carga de Xuxemons propios.
  loadTeamAndXuxemons(): void {
    this.subs.add(
      this.xuxemonService.myXuxemonsList.subscribe((list: Xuxemon[]) => {
        // Sirve para limitar la lista al equipo elegido cuando existen slots configurados.
        const filtered = this.teamIds.length > 0
          ? list.filter((xuxemon) => xuxemon.adquired_id !== undefined && this.teamIds.includes(Number(xuxemon.adquired_id)))
          : list;

        this.myXuxemons.set(filtered);
        this.refreshSelectedFromTeam(filtered);
        const switchMax = Math.max(0, this.getBagTotalPages(this.getSwitchMenuXuxemons().length) - 1);
        if (this.switchPage() > switchMax) {
          this.switchPage.set(switchMax);
        }
        this.cdr.detectChanges();
      }),
    );

    this.subs.add(
      this.teamService.getTeam().subscribe((team: any) => {
        this.team.set(team);
        this.teamIds = [
          team.slot_1_adquired_xuxemon_id,
          team.slot_2_adquired_xuxemon_id,
          team.slot_3_adquired_xuxemon_id,
          team.slot_4_adquired_xuxemon_id,
          team.slot_5_adquired_xuxemon_id,
          team.slot_6_adquired_xuxemon_id,
        ]
          .filter((id) => id !== null)
          .map((id) => Number(id));

        void this.xuxemonService.loadMyXuxemons();
      }),
    );
  }

  // Sirve para saber si una batalla enlazada sigue activa y acepta acciones.
  isLinkedBattleActive(): boolean {
    const data = this.battleData();
    return data?.status === 'accepted' && !data?.winner_id;
  }

  // Sirve para unificar la disponibilidad de acciones entre práctica y PvP.
  isBattleActive(): boolean {
    return this.isPractice() || this.isLinkedBattleActive();
  }

  // Sirve para exponer si el jugador puede abrir o usar el menú principal de combate.
  canPlayerAct(): boolean {
    return this.isBattleActive()
      && this.battleStatus() === 'ready'
      && this.currentTurn() === 'player'
      && !!this.selectedXuxemon()
      && !!this.opponentXuxemon();
  }

  // Sirve para mostrar un mensaje coherente cuando el combate no admite más acciones.
  inactiveBattleMessage(): string {
    const data = this.battleData();
    if (data?.winner_id || data?.status === 'completed') {
      return 'Battle finished.';
    }

    if (data?.status === 'rejected') {
      return 'Battle is no longer available.';
    }

    if (data?.status === 'pending') {
      return 'Waiting for the other trainer to accept the battle.';
    }

    return 'Battle is not active.';
  }

  // Sirve para sacar al usuario de una ruta de combate inválida cuando el backend ya no la admite.
  private scheduleInactiveBattleExit(): void {
    if (this.isPractice() || this.inactiveBattleRedirectTimeout) {
      return;
    }

    this.stopBattleSync();
    this.inactiveBattleRedirectTimeout = setTimeout(() => {
      this.inactiveBattleRedirectTimeout = null;
    }, 0);
    this.bypassDeactivateGuard = true;

    if (this.isBrowser && typeof window !== 'undefined') {
      window.location.assign('/friends');
      return;
    }

    this.router.navigate(['/friends']);
  }

  // Sirve para evitar que la cabecera anuncie un turno jugable cuando el backend ya no acepta acciones.
  battleTurnLabel(): string {
    if (!this.isBattleActive()) {
      return this.battleData()?.winner_id ? 'BATTLE FINISHED' : 'BATTLE INACTIVE';
    }

    if (this.battleStatus() !== 'ready') {
      return 'WAITING FOR BATTLE';
    }

    return this.currentTurn() === 'player' ? 'YOUR TURN' : 'OPPONENT TURN';
  }

  // Sirve para abrir o cambiar el submenú de combate (ataques, bolsa, cambio o huida) respetando el cambio forzado.
  showSubMenu(menu: BattleMenu): void {
    if (!this.isBattleActive()) {
      return;
    }

    if (this.forcedSwitch() && menu !== 'switch') {
      return;
    }

    if (menu === 'bag') {
      this.bagPage.set(0);
    }

    if (menu === 'switch') {
      this.switchPage.set(0);
    }

    this.currentSubMenu.set(menu);
  }

  // Sirve para elegir el Xuxemon activo del jugador en modo práctica y preparar al rival si hace falta.
  selectXuxemon(xuxemon: Xuxemon): void {
    if (!this.isPractice()) {
      return;
    }

    if (this.getCurrentHpValue(xuxemon) <= 0) {
      return;
    }

    this.selectedXuxemon.set(xuxemon);
    this.syncPlayerBars(xuxemon);

    if (this.isPractice() && this.opponentTeam().length === 0) {
      this.pickPracticeOpponentTeam();
      return;
    }

    if (this.opponentXuxemon()) {
      this.battleStatus.set('ready');
    }
  }

  // Sirve para iniciar el uso de un objeto de la bolsa comprobando validez y objetivos elegibles.
  chooseBagItem(item: InventoryItem): void {
    if (!this.isBattleActive()) {
      return;
    }

    if (!this.isBattleUsableItem(item)) {
      this.addLog(`${item.name} cannot be used during battle.`, 'system');
      return;
    }

    const eligibleTargets = this.getEligibleItemTargetsForItem(item);
    if (eligibleTargets.length === 0) {
      this.addLog(`No valid targets for ${item.name}.`, 'system');
      return;
    }

    this.selectedBattleItem.set(item);
    this.bagTargetPage.set(0);
    this.currentSubMenu.set('bag-target');
  }

  // Sirve para volver del modo de elegir objetivo al listado de la bolsa sin usar el objeto.
  cancelBagTargeting(): void {
    this.selectedBattleItem.set(null);
    this.currentSubMenu.set('bag');
  }

  // Sirve para aplicar el objeto seleccionado sobre un Xuxemon objetivo (API, práctica o inventario local).
  useItemOnTarget(target: Xuxemon): void {
    const item = this.selectedBattleItem();
    if (!item?.bag_item_id) {
      return;
    }

    if (this.currentTurn() !== 'player' || this.battleStatus() !== 'ready') {
      return;
    }

    this.battleStatus.set('animating');

    if (!this.isPractice()) {
      this.submitLinkedBattleItemAction(item, target);
      return;
    }

    if (item.effect_type === 'Apply Status Effects') {
      this.useStatusItemOnTarget(item, target);
      return;
    }

    this.inventoryService.useItem(
      item.bag_item_id,
      target.adquired_id!,
      (data?: UseItemResponseData) => {
        if (data?.error) {
          this.addLog(data.message || `You cannot use ${item.name} right now.`, 'system');
          this.battleStatus.set('ready');
          return;
        }

        this.addLog(`You used ${item.name} on ${target.name}!`, 'player');

        const updatedTarget = this.applyItemResponseToXuxemon(target, data, item);
        if (updatedTarget) {
          this.replaceMyTeamMember(updatedTarget);
          if (this.selectedXuxemon()?.adquired_id === updatedTarget.adquired_id) {
            this.selectedXuxemon.set(updatedTarget);
            this.syncPlayerBars(updatedTarget);
          }
        }

        void this.xuxemonService.loadMyXuxemons();

        setTimeout(() => {
          this.selectedBattleItem.set(null);
          this.currentSubMenu.set(null);
          this.endTurn();
        }, 800);
      },
      (message) => {
        this.addLog(`Error: ${message}`, 'system');
        this.battleStatus.set('ready');
      },
    );
  }

  // Sirve para cambiar el Xuxemon activo del jugador, enviando la acción al backend o simulándola en práctica.
  switchXuxemon(xuxemon: Xuxemon): void {
    if (this.getCurrentHpValue(xuxemon) <= 0) {
      return;
    }

    if (!this.forcedSwitch() && (this.currentTurn() !== 'player' || this.battleStatus() !== 'ready')) {
      return;
    }

    const wasForced = this.forcedSwitch();

    if (!this.isPractice()) {
      this.battleStatus.set('animating');
      this.submitLinkedBattleAction({
        action_type: 'switch',
        target_adquired_xuxemon_id: xuxemon.adquired_id,
      });
      return;
    }

    this.battleStatus.set('animating');
    this.addLog('Xuxemon changed!', 'player');

    setTimeout(() => {
      this.selectedXuxemon.set(xuxemon);
      this.syncPlayerBars(xuxemon);
      this.currentSubMenu.set(null);
      this.selectedBattleItem.set(null);

      if (wasForced) {
        this.forcedSwitch.set(false);
        this.currentTurn.set('player');
        this.battleStatus.set('ready');
        return;
      }

      this.endTurn();
    }, 700);
  }

  // Sirve para pasar el turno al oponente al finalizar la acción del jugador en modo práctica.
  endTurn(): void {
    if (!this.isPractice()) {
      this.battleStatus.set('ready');
      return;
    }

    this.currentTurn.set('opponent');
    this.battleStatus.set('ready');
    setTimeout(() => this.opponentTurn(), this.isPractice() ? 1200 : 1600);
  }

  // Sirve para registrar un ataque del jugador: envío al servidor o ejecución local con dado y animación.
  attack(attackObj: any): void {
    if (!this.canPlayerAct()) {
      return;
    }

    if (!this.isPractice()) {
      this.battleStatus.set('animating');
      this.submitLinkedBattleAction({
        action_type: 'attack',
        attack_id: attackObj.id,
      });
      return;
    }

    this.diceValue.set(this.resolveRoll());
    this.executePlayerAttack(attackObj);
  }

  // Sirve para obtener un valor de dado válido (1–6) fijo o aleatorio según el contexto.
  private resolveRoll(finalValue?: number): number {
    return typeof finalValue === 'number'
      ? Math.max(1, Math.min(6, Math.round(finalValue)))
      : Math.floor(Math.random() * 6) + 1;
  }

  // Sirve para clasificar visualmente la tirada en baja, media o alta.
  private getDiceOutcomeTone(roll: number): 'low' | 'mid' | 'high' {
    if (roll <= 2) {
      return 'low';
    }
    if (roll <= 4) {
      return 'mid';
    }
    return 'high';
  }

  // Sirve para resolver el ataque del jugador en práctica: estados, daño, animaciones y posible debilitamiento rival.
  executePlayerAttack(attackObj: any): void {
    let attacker = this.selectedXuxemon();
    const defender = this.opponentXuxemon();
    if (!attacker || !defender) {
      return;
    }

    this.battleStatus.set('animating');

    const statusResolution = this.resolveStatusBeforeAttack(attacker, 'player');
    if (statusResolution.prevented) {
      if (statusResolution.keepTurn) {
        this.battleStatus.set('ready');
      }
      return;
    }

    attacker = this.selectedXuxemon()!;

    const modifiers = this.calculateModifiers(attacker, defender, 'player');
    const roll = this.diceValue() || 0;
    const visualType = this.getAttackVisualType(attacker, attackObj);
    const damageApplyDelayMs = this.getPracticeDamageApplyDelayMs(visualType);
    this.playDiceThenAttack('player', roll, attacker, attackObj);

    const defenderMaxHp = defender.hp || 100;
    const defenderCurrentHp = this.getCurrentHpValue(defender);

    // TAREA 1: daño calculado con atributos reales del Xuxemon (power, speed, technical).
    // attackerStat usa el ataque base del atacante (campo `attack`).
    const attackerStat = attacker.attack || 10;
    let damageAmount = this.calculateDamageAmount(attackerStat, attackObj.dmg, roll, modifiers, defenderMaxHp);
    const hadSleep = normalizedStatusName(defender.statusEffect?.name) === 'sleep';

    // TAREA 6 – Sleep: recibe el doble de daño y despierta al recibir el golpe.
    if (hadSleep) {
      damageAmount = Math.min(defenderCurrentHp, damageAmount * 2);
      this.addLog(`${defender.name} woke up!`, 'system');
    }

    const newHpValue = Math.max(0, defenderCurrentHp - damageAmount);
    const newHpPercent = defenderMaxHp > 0 ? (newHpValue / defenderMaxHp) * 100 : 0;
    const defenderAfterHit = hadSleep
      ? { ...defender, current_hp: newHpValue, statusEffect: undefined, status_effect_turns: undefined }
      : { ...defender, current_hp: newHpValue };
    const updatedDefender = this.applyAttackStatusEffectToTarget(defenderAfterHit, attackObj, 'player');

    this.addLog(`${attacker.name} used ${attackObj.name}! (Roll: ${roll}, -${damageAmount} HP)`, 'player');

    // Aplica daño tras cerrar el overlay del dado y alcanzar el impacto (no solapar con la tirada).
    setTimeout(() => {
      this.zone.run(() => {
        this.opponentHP.set(newHpPercent);
        this.updateOpponentStateAfterItem(updatedDefender);

        if (newHpValue <= 0) {
          this.handleOpponentFaint();
          return;
        }

        this.endTurn();
      });
    }, damageApplyDelayMs);
  }

  // Sirve para ejecutar el turno de la IA en modo práctica eligiendo ataque y aplicando el mismo flujo de daño.
  opponentTurn(): void {
    if (!this.isPractice()) {
      return;
    }

    if (this.battleStatus() === 'finished' || this.forcedSwitch()) {
      return;
    }

    let opponent = this.opponentXuxemon();
    const player = this.selectedXuxemon();
    if (!opponent || !player) {
      return;
    }

    this.battleStatus.set('animating');

    const statusResolution = this.resolveStatusBeforeAttack(opponent, 'opponent');
    if (statusResolution.prevented) {
      return;
    }

    opponent = this.opponentXuxemon()!;

    const availableAttacks = opponent.attacks && opponent.attacks.length > 0
      ? opponent.attacks
      : [{ name: 'Tackle', dmg: 10, status_chance: null, statusEffect: undefined }];
    const randomAttack = availableAttacks[Math.floor(Math.random() * availableAttacks.length)];

    this.diceValue.set(this.resolveRoll());
    this.executeOpponentAttack(randomAttack);
  }

  // Sirve para aplicar el ataque del oponente al jugador en práctica y gestionar debilitamiento o fin de turno.
  private executeOpponentAttack(attackObj: any): void {
    const opponent = this.opponentXuxemon();
    const player = this.selectedXuxemon();
    if (!opponent || !player) {
      this.currentTurn.set('player');
      this.battleStatus.set('ready');
      return;
    }

    const opponentAttack = opponent.attack || 10;
    const roll = this.diceValue() || 0;
    const visualType = this.getAttackVisualType(opponent, attackObj);
    const damageApplyDelayMs = this.getPracticeDamageApplyDelayMs(visualType);
    this.playDiceThenAttack('opponent', roll, opponent, attackObj);

    const playerMaxHp = player.hp || 100;
    const playerCurrentHp = this.getCurrentHpValue(player);

    // TAREA 1: daño usa atributos reales del Xuxemon.
    let damageAmount = this.calculateDamageAmount(
      opponentAttack,
      attackObj.dmg,
      roll,
      this.calculateModifiers(opponent, player, 'opponent'),
      playerMaxHp,
    );
    const hadSleep = normalizedStatusName(player.statusEffect?.name) === 'sleep';

    // TAREA 6 – Sleep: recibe el doble de daño y despierta.
    if (hadSleep) {
      damageAmount = Math.min(playerCurrentHp, damageAmount * 2);
      this.addLog(`${player.name} woke up!`, 'system');
    }

    const newHpValue = Math.max(0, playerCurrentHp - damageAmount);
    const newHpPercent = playerMaxHp > 0 ? (newHpValue / playerMaxHp) * 100 : 0;
    const playerAfterHit = hadSleep
      ? { ...player, current_hp: newHpValue, statusEffect: undefined, status_effect_turns: undefined }
      : { ...player, current_hp: newHpValue };
    const updatedPlayer = this.applyAttackStatusEffectToTarget(playerAfterHit, attackObj, 'opponent');

    this.addLog(`${opponent.name} used ${attackObj.name}! (Roll: ${roll}, -${damageAmount} HP)`, 'opponent');

    setTimeout(() => {
      this.zone.run(() => {
        this.playerHP.set(newHpPercent);
        this.updateMyTeamHp(updatedPlayer, newHpValue);

        if (updatedPlayer.adquired_id) {
          this.subs.add(this.xuxemonService.updateCurrentHp(updatedPlayer.adquired_id, newHpValue).subscribe());
        }

        if (newHpValue <= 0) {
          this.handlePlayerFaint();
          return;
        }

        this.currentTurn.set('player');
        this.battleStatus.set('ready');
      });
    }, damageApplyDelayMs);
  }

  // Sirve para calcular las bonificaciones y penalizaciones de daño por tipos y tamaño del atacante.
  calculateModifiers(attacker: Xuxemon, defender: Xuxemon, side: BattleLogSource = 'system'): number {
    let modifiers = 0;
    const attackerType = attacker.type?.name?.toLowerCase() || '';
    const defenderType = defender.type?.name?.toLowerCase() || '';
    let effectiveness: 'buff' | 'nerf' | null = null;

    const typeAdvantage =
      (attackerType === 'power' && defenderType === 'speed')
      || (attackerType === 'speed' && defenderType === 'technical')
      || (attackerType === 'technical' && defenderType === 'power');

    const typeDisadvantage =
      (attackerType === 'speed' && defenderType === 'power')
      || (attackerType === 'technical' && defenderType === 'speed')
      || (attackerType === 'power' && defenderType === 'technical');

    if (typeAdvantage) {
      modifiers += 1;
      this.addLog(`It's super effective! +1`, side);
      effectiveness = 'buff';
      this.showBattleCallout('SUPER EFFECTIVE!', 'buff');
    } else if (typeDisadvantage) {
      modifiers -= 1;
      this.addLog(`It's not very effective... -1`, side);
      effectiveness = 'nerf';
      this.showBattleCallout('NOT VERY EFFECTIVE', 'nerf');
    }

    if (attacker.size === 'Medium') {
      modifiers += 1;
      if (!effectiveness) {
        this.showBattleCallout('SIZE BONUS +1', 'neutral');
      }
    } else if (attacker.size === 'Large') {
      modifiers += 2;
      if (!effectiveness) {
        this.showBattleCallout('SIZE BONUS +2', 'neutral');
      }
    }

    return modifiers;
  }

  // TAREA 1: Daño = daño base del ataque + cara del dado + modificadores.
  // Solo usa atributos reales del Xuxemon (power, speed, technical → campo `attack`).
  // El factor *0.12 eliminado — no se usaba correctamente.
  calculateDamageAmount(
    attackerStat: number,
    attackDamage: number | undefined,
    roll: number,
    modifiers: number,
    defenderMaxHp: number,
  ): number {
    const baseAttackDamage = Math.max(1, Math.round(attackDamage ?? attackerStat ?? 10));
    const rawDamage = baseAttackDamage + roll + modifiers;
    const damageAmount = Math.max(1, Math.round(rawDamage));

    return Math.min(damageAmount, Math.max(1, defenderMaxHp));
  }

  // Sirve para añadir una línea al registro de combate visible en la interfaz.
  addLog(message: string, source: BattleLogSource = 'system'): void {
    this.battleLog.update((logs) => [...logs, { text: message, source }].slice(-8));
  }

  // Sirve para convertir entradas crudas del backend en líneas de log tipadas (jugador / rival / sistema).
  private hydrateBattleLogNames(logs: unknown[], activePlayer: Xuxemon | null, activeOpponent: Xuxemon | null): BattleLogEntry[] {
    const playerName = activePlayer?.name?.toLowerCase() ?? '';
    const opponentName = activeOpponent?.name?.toLowerCase() ?? '';

    return logs.map((entry) => {
      const text = (() => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (entry && typeof entry === 'object' && 'text' in entry) {
          const raw = (entry as { text?: unknown }).text;
          return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
        }
        return String(entry ?? '').trim();
      })();
      let normalizedText = text;

      if (/^come back\s+.+!\s+go\s+.+!$/i.test(text)) {
        normalizedText = 'Xuxemon changed!';
      } else if (/^.+\s+sent\s+out\s+.+!$/i.test(text)) {
        normalizedText = 'A Xuxemon enters the battle!';
      } else if (/^enters\s+the\s+battle!?$/i.test(text) || /^.+\s+enters\s+the\s+battle!?$/i.test(text)) {
        normalizedText = 'A Xuxemon enters the battle!';
      }

      const lowerText = normalizedText.toLowerCase();
      let source: BattleLogSource = 'system';
      if (playerName && lowerText.startsWith(playerName + ' used')) {
        source = 'player';
      } else if (opponentName && lowerText.startsWith(opponentName + ' used')) {
        source = 'opponent';
      }

      return { text: normalizedText, source };
    });
  }

  // Sirve para confirmar el Xuxemon robado al rival tras la victoria y cerrar el flujo de premio.
  confirmPrizeSelection(xuxemon: Xuxemon): void {
    const battleId = this.battleId();
    const winnerId = this.auth.getUser()?.id;
    if (!battleId || !winnerId || this.isSubmittingBattleResult()) {
      return;
    }

    this.isSubmittingBattleResult.set(true);
    this.subs.add(
      this.battleService.finishBattle(battleId, winnerId, xuxemon.adquired_id).subscribe({
        next: (response: any) => {
          this.isSubmittingBattleResult.set(false);
          this.showStealModal.set(false);
          this.showConfetti.set(true);
          this.showVictoryModal.set(true);
          this.stolenXuxemon.set(response?.stolen_xuxemon ?? xuxemon);
          this.refreshAuthenticatedUserStats();
          this.addLog(`${xuxemon.name} has joined your team.`, 'player');
          void this.xuxemonService.loadMyXuxemons();
        },
        error: () => {
          this.isSubmittingBattleResult.set(false);
          this.addLog('Could not complete the prize transfer.', 'system');
        },
      }),
    );
  }

  // Sirve para omitir el robo y mostrar directamente el modal de victoria cuando no hay opciones o el usuario cancela.
  skipPrizeSelection(): void {
    const battleId = this.battleId();
    const winnerId = this.auth.getUser()?.id;
    if (!battleId || !winnerId || this.isSubmittingBattleResult()) {
      return;
    }

    this.isSubmittingBattleResult.set(true);
    this.subs.add(
      this.battleService.finishBattle(battleId, winnerId).subscribe({
        next: () => {
          this.isSubmittingBattleResult.set(false);
          this.showStealModal.set(false);
          this.showConfetti.set(true);
          this.showVictoryModal.set(true);
          this.refreshAuthenticatedUserStats();
        },
        error: () => {
          this.isSubmittingBattleResult.set(false);
          this.addLog('Could not finish the battle.', 'system');
        },
      }),
    );
  }

  // Sirve para cerrar el combate en práctica o enlazado, detener sync y mostrar victoria, derrota o fin en servidor.
  finishBattle(playerWon: boolean): void {
    this.battleStatus.set('finished');
    this.currentSubMenu.set(null);
    this.selectedBattleItem.set(null);
    this.stopBattleMusic();
    this.stopBattleSync();

    if (playerWon) {
      this.addLog('VICTORY! You won the battle.', 'player');
      this.presentVictoryFlow();
      return;
    }

    this.addLog('DEFEAT...', 'opponent');

    if (!this.isPractice()) {
      const winnerId = this.getOpponentUserId();
      if (winnerId && this.battleId()) {
        this.subs.add(this.battleService.finishBattle(this.battleId()!, winnerId).subscribe());
      }
    }

    setTimeout(() => {
      alert('Defeat! You lost the battle.');
      this.router.navigate(['/friends']);
    }, 1500);
  }

  // Sirve para ocultar el modal de victoria y navegar al perfil o a amigos según el modo.
  closeVictoryModal(): void {
    this.showVictoryModal.set(false);
    this.stopBattleMusic();
    this.router.navigate([this.isPractice() ? '/profile' : '/friends']);
  }

  // Sirve para pedir confirmación al usuario antes de abandonar la ruta de batalla con combate activo.
  canDeactivate(): Observable<boolean> | boolean {
    if (this.bypassDeactivateGuard) {
      this.bypassDeactivateGuard = false;
      return true;
    }

    if (this.battleStatus() === 'finished') {
      return true;
    }
    this.navGuardSubject = new Subject<boolean>();
    this.showRunConfirmModal.set(true);
    return this.navGuardSubject.asObservable();
  }

  // Sirve para abrir la confirmación de huida (el envío real ocurre al confirmar o al rendirse fuera de turno).
  runAway(): void {
    if (this.forcedSwitch()) {
      return;
    }

    this.showRunConfirmModal.set(true);
  }

  // Sirve para cerrar el modal de huida y rechazar la guarda de navegación si estaba pendiente.
  cancelRunAway(): void {
    this.showRunConfirmModal.set(false);
    if (this.navGuardSubject) {
      this.navGuardSubject.next(false);
      this.navGuardSubject.complete();
      this.navGuardSubject = null;
    }
  }

  // Sirve para confirmar la huida o rendición, ya sea desde el modal o desde la guarda de ruta.
  confirmRunAway(): void {
    if (this.isSubmittingRun()) {
      return;
    }

    this.showRunConfirmModal.set(false);
    const isPlayerTurn = this.currentTurn() === 'player' && this.battleStatus() === 'ready';

    if (this.navGuardSubject) {
      // Triggered by navbar navigation guard — block original nav, handle our own
      const subject = this.navGuardSubject;
      this.navGuardSubject = null;
      subject.next(false);
      subject.complete();

      if (this.isPractice()) {
        this.stopBattleMusic();
        this.router.navigate(['/friends']);
        return;
      }

      this.isSubmittingRun.set(true);
      if (isPlayerTurn) {
        this.submitLinkedBattleAction({ action_type: 'run' });
      } else {
        this.submitForfeit();
      }
      return;
    }

    if (this.isPractice()) {
      this.router.navigate(['/friends']);
      return;
    }

    this.isSubmittingRun.set(true);
    if (isPlayerTurn) {
      this.submitLinkedBattleAction({ action_type: 'run' });
    } else {
      this.submitForfeit();
    }
  }

  // Sirve para cerrar el aviso de resultado de huida y salir a la lista de amigos.
  closeRunawayResultModal(): void {
    this.showRunawayResultModal.set(false);
    this.stopBattleMusic();
    this.router.navigate(['/friends']);
  }

  // Sirve para resolver rutas de assets estáticos del combate respetando la configuración de auth.
  getAssetUrl(path: string): string {
    return this.auth.getAssetUrl(path);
  }

  // Sirve para listar efectos secundarios activos de un Xuxemon para mostrarlos en la UI de batalla.
  getXuxemonSideEffects(xuxemon: Xuxemon | null): Array<{ name: string; icon_url: string | null }> {
    if (!xuxemon) {
      return [];
    }

    return [
      xuxemon.side_effect_1,
      xuxemon.side_effect_2,
      xuxemon.side_effect_3,
    ]
      .filter((effect): effect is NonNullable<Xuxemon['side_effect_1']> => Boolean(effect?.name?.trim()))
      .map((effect) => ({
        name: effect.name,
        icon_url: effect.icon_url ?? null,
      }));
  }

  // Sirve para combinar estado alterado principal y efectos secundarios en una lista para la UI.
  getXuxemonAllStates(xuxemon: Xuxemon | null): Array<{ name: string; icon_url: string | null }> {
    if (!xuxemon) {
      return [];
    }

    return [
      xuxemon.statusEffect
        ? {
          name: xuxemon.statusEffect.name,
          icon_url: xuxemon.statusEffect.icon_url ?? null,
        }
        : null,
      ...this.getXuxemonSideEffects(xuxemon),
    ].filter((state): state is { name: string; icon_url: string | null } => Boolean(state?.name?.trim()));
  }

  // Sirve para obtener aliados vivos distintos del activo cuando el jugador debe cambiar de Xuxemon.
  getSwitchCandidates(): Xuxemon[] {
    const currentId = this.selectedXuxemon()?.adquired_id;
    return this.myXuxemons().filter((xuxemon) => this.getCurrentHpValue(xuxemon) > 0 && xuxemon.adquired_id !== currentId);
  }

  // Sirve para listar el equipo propio en el menú de cambio sin duplicados ni el combatiente actual.
  getSwitchMenuXuxemons(): Xuxemon[] {
    const seen = new Set<string>();
    const active = this.selectedXuxemon();

    return this.myXuxemons().filter((xuxemon) => {
      if (this.getCurrentHpValue(xuxemon) <= 0) {
        return false;
      }

      if (active && this.isSameXuxemon(active, xuxemon)) {
        return false;
      }

      const key = xuxemon.adquired_id !== undefined
        ? `adquired:${xuxemon.adquired_id}`
        : `base:${xuxemon.id}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  // Sirve para saber si un Xuxemon del equipo puede ser elegido como sustituto en combate.
  canSwitchToXuxemon(xuxemon: Xuxemon): boolean {
    return this.getCurrentHpValue(xuxemon) > 0 && !this.isPlayerActiveXuxemon(xuxemon);
  }

  // Sirve para comprobar si un Xuxemon es el combatiente activo del jugador.
  isPlayerActiveXuxemon(xuxemon: Xuxemon): boolean {
    const active = this.selectedXuxemon();
    return !!active && this.isSameXuxemon(active, xuxemon);
  }

  // Sirve para comprobar si un Xuxemon es el combatiente activo del rival.
  isOpponentActiveXuxemon(xuxemon: Xuxemon): boolean {
    const active = this.opponentXuxemon();
    return !!active && this.isSameXuxemon(active, xuxemon);
  }

  // Sirve para obtener los aliados válidos como objetivo del objeto de bolsa seleccionado.
  getEligibleItemTargets(): Xuxemon[] {
    return this.getEligibleItemTargetsForItem(this.selectedBattleItem());
  }

  paginatedEligibleItemTargets(): Xuxemon[] {
    const list = this.getEligibleItemTargets();
    const start = this.bagTargetPage() * this.bagPageSize;
    return list.slice(start, start + this.bagPageSize);
  }

  bagTargetPageCount(): number {
    return this.getBagTotalPages(this.getEligibleItemTargets().length);
  }

  canGoToPreviousBagTargetPage(): boolean {
    return this.bagTargetPage() > 0;
  }

  canGoToNextBagTargetPage(): boolean {
    return this.bagTargetPage() < this.bagTargetPageCount() - 1;
  }

  previousBagTargetPage(): void {
    if (!this.canGoToPreviousBagTargetPage()) {
      return;
    }
    this.bagTargetPage.update((page) => Math.max(0, page - 1));
  }

  nextBagTargetPage(): void {
    if (!this.canGoToNextBagTargetPage()) {
      return;
    }
    this.bagTargetPage.update((page) => Math.min(this.bagTargetPageCount() - 1, page + 1));
  }

  battleBagTargetPageLabel(): string {
    return `Page ${this.bagTargetPage() + 1} / ${this.bagTargetPageCount()}`;
  }

  // Sirve para exponer el trozo de inventario de bolsa correspondiente a la página actual.
  paginatedBagItems(): InventoryItem[] {
    const start = this.bagPage() * this.bagPageSize;
    return this.myItems().slice(start, start + this.bagPageSize);
  }

  // Sirve para calcular cuántas páginas tiene la bolsa según el tamaño de página configurado.
  bagPageCount(): number {
    return this.getBagTotalPages(this.myItems().length);
  }

  // Sirve para habilitar o no el botón de página anterior en la bolsa.
  canGoToPreviousBagPage(): boolean {
    return this.bagPage() > 0;
  }

  // Sirve para habilitar o no el botón de página siguiente en la bolsa.
  canGoToNextBagPage(): boolean {
    return this.bagPage() < this.bagPageCount() - 1;
  }

  // Sirve para retroceder una página en el listado paginado de la bolsa.
  previousBagPage(): void {
    if (!this.canGoToPreviousBagPage()) {
      return;
    }

    this.bagPage.update((page) => Math.max(0, page - 1));
  }

  // Sirve para avanzar una página en el listado paginado de la bolsa.
  nextBagPage(): void {
    if (!this.canGoToNextBagPage()) {
      return;
    }

    this.bagPage.update((page) => Math.min(this.bagPageCount() - 1, page + 1));
  }

  // Sirve para el texto del indicador de página de la bolsa (espacios alrededor de la barra).
  battleBagPageLabel(): string {
    return `Page ${this.bagPage() + 1} / ${this.bagPageCount()}`;
  }

  // Sirve para listar Xuxemons del menú de cambio en la página actual.
  paginatedSwitchMenuXuxemons(): Xuxemon[] {
    const list = this.getSwitchMenuXuxemons();
    const start = this.switchPage() * this.bagPageSize;
    return list.slice(start, start + this.bagPageSize);
  }

  // Sirve para calcular cuántas páginas tiene el menú de cambio.
  switchMenuPageCount(): number {
    return this.getBagTotalPages(this.getSwitchMenuXuxemons().length);
  }

  // Sirve para habilitar el botón de página anterior en el menú de cambio.
  canGoToPreviousSwitchMenuPage(): boolean {
    return this.switchPage() > 0;
  }

  // Sirve para habilitar el botón de página siguiente en el menú de cambio.
  canGoToNextSwitchMenuPage(): boolean {
    return this.switchPage() < this.switchMenuPageCount() - 1;
  }

  // Sirve para retroceder una página en el menú de cambio.
  previousSwitchMenuPage(): void {
    if (!this.canGoToPreviousSwitchMenuPage()) {
      return;
    }

    this.switchPage.update((page) => Math.max(0, page - 1));
  }

  // Sirve para avanzar una página en el menú de cambio.
  nextSwitchMenuPage(): void {
    if (!this.canGoToNextSwitchMenuPage()) {
      return;
    }

    this.switchPage.update((page) => Math.min(this.switchMenuPageCount() - 1, page + 1));
  }

  // Sirve para el texto del indicador de página del menú de cambio (espacios alrededor de la barra).
  battleSwitchMenuPageLabel(): string {
    return `Page ${this.switchPage() + 1} / ${this.switchMenuPageCount()}`;
  }

  // Sirve para resolver objetivos válidos de un objeto concreto según su tipo de efecto.
  private getEligibleItemTargetsForItem(item: InventoryItem | null): Xuxemon[] {
    const team = this.myXuxemons();
    if (!item) {
      return [];
    }

    if (item.effect_type === 'Apply Status Effects') {
      const opponent = this.opponentXuxemon();
      if (!opponent || this.getCurrentHpValue(opponent) <= 0) {
        return [];
      }

      return [opponent];
    }

    const available = team.filter((xuxemon) => xuxemon.adquired_id !== undefined);
    const alive = available.filter((xuxemon) => this.getCurrentHpValue(xuxemon) > 0);

    if (item.effect_type === 'Heal') {
      return this.sortEligibleTargetsActiveFirst(
        alive.filter((xuxemon) => (xuxemon.current_hp ?? xuxemon.hp ?? 0) < (xuxemon.hp ?? 0)),
      );
    }

    if (item.effect_type === 'DMG Up' || item.effect_type === 'Defense Up') {
      return this.sortEligibleTargetsActiveFirst(alive);
    }

    if (item.effect_type === 'Remove Status Effects') {
      return this.sortEligibleTargetsActiveFirst(
        alive.filter((xuxemon) => this.canUseStatusItemOnTarget(item, xuxemon)),
      );
    }

    return this.sortEligibleTargetsActiveFirst(alive);
  }

  /** Objetivos aliados: el Xuxemon activo del jugador primero si es elegible. */
  private sortEligibleTargetsActiveFirst(targets: Xuxemon[]): Xuxemon[] {
    const active = this.selectedXuxemon();
    if (!active || targets.length <= 1) {
      return targets;
    }
    const activeEntry = targets.find((xuxemon) => this.isSameXuxemon(xuxemon, active));
    if (!activeEntry) {
      return targets;
    }
    const rest = targets.filter((xuxemon) => !this.isSameXuxemon(xuxemon, active));
    return [activeEntry, ...rest];
  }

  // Sirve para comprobar si un objeto del inventario puede usarse durante el combate.
  private isBattleUsableItem(item: InventoryItem): boolean {
    return item.effect_type !== undefined && this.supportedBattleEffectTypes.has(item.effect_type);
  }

  // Sirve para filtrar qué ítems aparecen en la bolsa de combate frente al inventario completo.
  private shouldDisplayInBattleBag(item: InventoryItem): boolean {
    if (item.effect_type === 'Gacha Ticket') {
      return false;
    }

    return !this.isBattleExcludedEvolutionItem(item);
  }

  // Sirve para excluir objetos de evolución del listado usable en batalla.
  private isBattleExcludedEvolutionItem(item: InventoryItem): boolean {
    return item.effect_type === 'Evolve';
  }

  // Sirve para calcular el número de páginas de bolsa a partir de la cantidad de ítems.
  private getBagTotalPages(itemCount: number): number {
    return Math.max(1, Math.ceil(itemCount / this.bagPageSize));
  }

  // Sirve para actualizar el equipo rival en memoria y mantener coherente al Xuxemon activo rival.
  private syncOpponentTeam(team: Xuxemon[]): void {
    if (team.length === 0) {
      return;
    }

    this.opponentTeam.set(team);
    const currentOpponentId = this.opponentXuxemon()?.adquired_id;
    const refreshedOpponent = team.find((xuxemon) => xuxemon.adquired_id === currentOpponentId);
    const nextOpponent = refreshedOpponent ?? this.getFirstAlive(team);

    if (nextOpponent) {
      this.opponentXuxemon.set(nextOpponent);
      this.syncOpponentBars(nextOpponent);
      if (this.selectedXuxemon()) {
        this.battleStatus.set('ready');
      }
    }
  }

  // Sirve para aplicar al estado local la respuesta del backend: equipos, turno, log y cambio forzado.
  private applyBattleSnapshot(data: any): void {
    const previousActivePlayer = this.selectedXuxemon();
    const previousActiveOpponent = this.opponentXuxemon();
    const normalizedMyTeam = Array.isArray(data.my_team)
      ? data.my_team.map((xuxemon: any) => this.normalizeBattleXuxemon(xuxemon))
      : [];
    const normalizedOpponentTeam = Array.isArray(data.opponent_team)
      ? data.opponent_team.map((xuxemon: any) => this.normalizeBattleXuxemon(xuxemon))
      : [];
    const normalizedOpponentAvailable = Array.isArray(data.opponent_available_xuxemons)
      ? data.opponent_available_xuxemons.map((xuxemon: any) => this.normalizeBattleXuxemon(xuxemon))
      : [];

    const normalizedData = {
      ...data,
      my_team: normalizedMyTeam,
      opponent_team: normalizedOpponentTeam,
      opponent_available_xuxemons: normalizedOpponentAvailable,
    };
    this.battleData.set(normalizedData);

    const user = this.auth.getUser();
    if (!user) {
      return;
    }

    if (normalizedData.status === 'accepted' && !normalizedData.winner_id) {
      const isMyTurn = (normalizedData.turn % 2 === 0 && this.sameId(normalizedData.user_id, user.id))
        || (normalizedData.turn % 2 !== 0 && this.sameId(normalizedData.opponent_user_id, user.id));
      this.currentTurn.set(isMyTurn ? 'player' : 'opponent');
    }

    if (normalizedData.user && normalizedData.opponent_user) {
      const isOwner = this.sameId(normalizedData.user_id, user.id);
      const opponentTrainer = isOwner ? normalizedData.opponent_user : normalizedData.user;
      this.opponentTrainerName.set(opponentTrainer.name);
      this.opponentTrainerLevel.set(opponentTrainer.level || 1);
      this.opponentTrainerIcon.set(this.auth.getAssetUrl(opponentTrainer.icon_path || ''));
    }

    const myTeam = normalizedMyTeam;
    const opponentTeam = normalizedOpponentTeam;

    // Sirve para priorizar el activo indicado por backend y hacer fallback al primer Xuxemon vivo.
    if (myTeam.length > 0) {
      this.myXuxemons.set(myTeam);
    }
    if (opponentTeam.length > 0) {
      this.opponentTeam.set(opponentTeam);
    }

    const activePlayer = myTeam.find((xuxemon: Xuxemon) => xuxemon.adquired_id === normalizedData.my_active_xuxemon_id)
      ?? this.getFirstAlive(myTeam);
    if (activePlayer) {
      this.selectedXuxemon.set(activePlayer);
    }

    const activeOpponent = opponentTeam.find((xuxemon: Xuxemon) => xuxemon.adquired_id === normalizedData.opponent_active_xuxemon_id)
      ?? this.getFirstAlive(opponentTeam);
    if (activeOpponent) {
      this.opponentXuxemon.set(activeOpponent);
    }

    let barsSyncDelayMs = 0;

    if (Array.isArray(normalizedData.battle_log)) {
      const hydratedLog = this.hydrateBattleLogNames(normalizedData.battle_log, activePlayer, activeOpponent);
      this.battleLog.set(hydratedLog);
      barsSyncDelayMs = this.triggerBattleAnimationsFromSnapshot(
        { ...normalizedData, battle_log: hydratedLog },
        {
          currentPlayer: activePlayer ?? null,
          currentOpponent: activeOpponent ?? null,
          previousPlayer: previousActivePlayer,
          previousOpponent: previousActiveOpponent,
        },
      );
    }

    this.syncCombatantBarsWithDelay(activePlayer ?? null, activeOpponent ?? null, barsSyncDelayMs);

    const requiresForcedSwitch = Boolean(
      activePlayer
      && this.getCurrentHpValue(activePlayer) <= 0
      && this.currentTurn() === 'player'
      && myTeam.some((xuxemon: Xuxemon) => this.getCurrentHpValue(xuxemon) > 0 && xuxemon.adquired_id !== activePlayer.adquired_id)
      && !normalizedData.winner_id,
    );

    const hadForcedSwitch = this.forcedSwitch();
    this.forcedSwitch.set(requiresForcedSwitch);
    if (requiresForcedSwitch) {
      if (!hadForcedSwitch) {
        this.switchPage.set(0);
      }
      this.currentSubMenu.set('switch');
    } else if (hadForcedSwitch) {
      this.currentSubMenu.set(null);
    }

    if (normalizedData.status === 'rejected') {
      this.currentSubMenu.set(null);
      this.selectedBattleItem.set(null);
      this.battleStatus.set('finished');
      this.addLog('This battle is no longer available.', 'system');
      this.scheduleInactiveBattleExit();
      return;
    }

    if (normalizedData.status === 'pending') {
      this.currentSubMenu.set(null);
      this.selectedBattleItem.set(null);
      this.battleStatus.set('selecting');
      this.addLog('Waiting for the other trainer to accept the battle.', 'system');
      this.scheduleInactiveBattleExit();
      return;
    }

    if (normalizedData.winner_id || normalizedData.status === 'completed') {
      this.currentSubMenu.set(null);
      this.selectedBattleItem.set(null);
      this.battleStatus.set('finished');
      return;
    }

    if (!normalizedData.winner_id) {
      this.battleStatus.set(activePlayer && activeOpponent ? 'ready' : 'selecting');
    }
  }

  // Sirve para adaptar la forma cruda del API al modelo `Xuxemon` usado en la vista de batalla.
  private normalizeBattleXuxemon(raw: any): Xuxemon {
    const rawImage = typeof raw?.image_url === 'string' ? raw.image_url : '';
    const hasAbsoluteImage = rawImage.startsWith('http://') || rawImage.startsWith('https://');
    const assetPath = raw?.icon_path
      ? this.auth.getAssetUrl(raw.icon_path.startsWith('/') ? raw.icon_path : `/${raw.icon_path}`)
      : '';
    const rawAttacks = Array.isArray(raw?.attacks) && raw.attacks.length > 0
      ? raw.attacks
      : [raw?.attack1, raw?.attack2].filter(Boolean);

    const statusEffect = this.normalizeEffect(
      raw?.statusEffect ?? raw?.status_effect ?? raw?.status_effect_applied,
    );

    return {
      ...raw,
      image_url: hasAbsoluteImage
        ? rawImage
        : (rawImage ? this.auth.getAssetUrl(rawImage.startsWith('/') ? rawImage : `/${rawImage}`) : assetPath),
      level: (() => {
        const v = raw?.level;
        if (v == null || v === '') {
          return undefined;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      })(),
      statusEffect,
      status_effect_turns: (() => {
        if (!statusEffect) {
          return undefined;
        }
        const v = raw?.status_effect_turns;
        if (v == null || v === '') {
          return undefined;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      })(),
      side_effect_1: this.normalizeEffect(raw?.side_effect_1 ?? raw?.sideEffect1),
      side_effect_2: this.normalizeEffect(raw?.side_effect_2 ?? raw?.sideEffect2),
      side_effect_3: this.normalizeEffect(raw?.side_effect_3 ?? raw?.sideEffect3),
      attacks: rawAttacks.map((attack: any) => ({
        id: attack.id,
        name: attack.name,
        description: attack.description,
        dmg: attack.dmg ?? raw?.attack ?? 10,
        status_chance: attack.status_chance ?? null,
        statusEffect: attack.statusEffect?.name
          ? {
            name: attack.statusEffect.name,
            icon_url: attack.statusEffect.icon_url
              ?? (attack.statusEffect.icon_path ? this.auth.getAssetUrl(`/${attack.statusEffect.icon_path}`) : ''),
          }
          : undefined,
      })),
    } as Xuxemon;
  }

  // Sirve para normalizar un efecto de estado o lateral con nombre e icono resueltos a URL.
  private normalizeEffect(
    effect: { name?: string; icon_url?: string; icon_path?: string } | null | undefined,
  ): { name: string; icon_url: string } | undefined {
    const name = effect?.name?.trim();
    if (!name) {
      return undefined;
    }

    const rawIcon = effect?.icon_url?.trim();
    const iconFromUrl = rawIcon
      ? (rawIcon.startsWith('http://') || rawIcon.startsWith('https://')
        ? rawIcon
        : this.auth.getAssetUrl(rawIcon.startsWith('/') ? rawIcon : `/${rawIcon}`))
      : '';
    const iconFromPath = effect?.icon_path
      ? this.auth.getAssetUrl(effect.icon_path.startsWith('/') ? effect.icon_path : `/${effect.icon_path}`)
      : '';

    return {
      name,
      icon_url: iconFromUrl || iconFromPath || '',
    };
  }

  // Sirve para disparar animaciones de ataque y dado a partir del último evento del log del snapshot.
  private triggerBattleAnimationsFromSnapshot(
    data: any,
    combatants?: {
      currentPlayer: Xuxemon | null;
      currentOpponent: Xuxemon | null;
      previousPlayer: Xuxemon | null;
      previousOpponent: Xuxemon | null;
    },
  ): number {
    const playerCandidates = [combatants?.currentPlayer, combatants?.previousPlayer]
      .filter((xuxemon): xuxemon is Xuxemon => Boolean(xuxemon));
    const opponentCandidates = [combatants?.currentOpponent, combatants?.previousOpponent]
      .filter((xuxemon): xuxemon is Xuxemon => Boolean(xuxemon));
    const knownCombatants = new Map<string, Array<{ side: 'player' | 'opponent'; xuxemon: Xuxemon }>>();
    const registerCombatant = (side: 'player' | 'opponent', xuxemon: Xuxemon): void => {
      const key = xuxemon.name.trim().toLowerCase();
      if (!key) {
        return;
      }

      const entries = knownCombatants.get(key) ?? [];
      const alreadyRegistered = entries.some((entry) =>
        entry.side === side && this.isSameXuxemon(entry.xuxemon, xuxemon),
      );

      if (!alreadyRegistered) {
        entries.push({ side, xuxemon });
        knownCombatants.set(key, entries);
      }
    };

    for (const xuxemon of playerCandidates) {
      registerCombatant('player', xuxemon);
    }

    for (const xuxemon of opponentCandidates) {
      registerCombatant('opponent', xuxemon);
    }

    const readBattleLogText = (entry: unknown): string => {
      if (typeof entry === 'string') {
        return entry.trim();
      }

      if (entry && typeof entry === 'object' && 'text' in entry) {
        const raw = (entry as { text?: unknown }).text;
        return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
      }

      return String(entry ?? '').trim();
    };

    const attackLogData = (() => {
      if (!Array.isArray(data?.battle_log)) {
        return null;
      }

      const newestText = readBattleLogText(data.battle_log[data.battle_log.length - 1]);
      const isSwitchLog = /^.+\s+sent\s+out\s+.+!$/i.test(newestText)
        || /^come\s+back\s+.+!\s+go\s+.+!$/i.test(newestText)
        || /^xuxemon\s+changed!?$/i.test(newestText)
        || /^.+\s+enters\s+the\s+battle!?$/i.test(newestText)
        || /^.+\s+fled\s+the\s+battle!?$/i.test(newestText)
        || /^battle\s+(already\s+)?completed!?$/i.test(newestText)
        || /^you\s+used\s+.+/i.test(newestText)
        || /^.+\s+used\s+.+\s+on\s+.+!$/i.test(newestText);

      if (isSwitchLog) {
        return null;
      }

      for (let index = data.battle_log.length - 1; index >= 0; index -= 1) {
        const text = readBattleLogText(data.battle_log[index]);
        const match = /^(.+?) used (.+?)(?: on .+?)?!\s*\(Roll:\s*\d+/i.exec(text);
        if (!match) {
          continue;
        }

        const attackerRaw = match[1]?.trim().toLowerCase() ?? '';
        const attackerName = attackerRaw.replace(/\s*\(.+?\)\s*$/, '').trim();
        if (knownCombatants.size > 0 && attackerName && !knownCombatants.has(attackerName)) {
          continue;
        }

        return { text, index };
      }

      return null;
    })();

    const attackLog = attackLogData?.text ?? '';
    if (!attackLog || attackLog === 'Battle started!') {
      return 0;
    }

    const attackMatch = /^(.+?) used (.+?)(?: on .+?)?!\s*\(Roll:\s*\d+/i.exec(attackLog);
    if (!attackMatch) {
      return 0;
    }

    const attackerName = attackMatch[1]?.trim().replace(/\s*\(.+?\)\s*$/, '');
    const extractedAttackName = attackMatch[2]?.trim();
    const rollMatch = /Roll:\s*(\d+)/.exec(attackLog);
    const resolvedRoll = rollMatch ? Number(rollMatch[1]) : null;
    if (!attackerName) {
      return 0;
    }

    const attackerCandidates = knownCombatants.get(attackerName.toLowerCase()) ?? [];
    let attackerContext = attackerCandidates.length === 1 ? attackerCandidates[0] : null;

    const inferAttackerFromHpDelta = (): { side: 'player' | 'opponent'; xuxemon: Xuxemon } | null => {
      const previousPlayerHp = combatants?.previousPlayer ? this.getCurrentHpValue(combatants.previousPlayer) : null;
      const currentPlayerHp = combatants?.currentPlayer ? this.getCurrentHpValue(combatants.currentPlayer) : null;
      const previousOpponentHp = combatants?.previousOpponent ? this.getCurrentHpValue(combatants.previousOpponent) : null;
      const currentOpponentHp = combatants?.currentOpponent ? this.getCurrentHpValue(combatants.currentOpponent) : null;

      const opponentTookDamage = previousOpponentHp !== null
        && currentOpponentHp !== null
        && currentOpponentHp < previousOpponentHp;
      const playerTookDamage = previousPlayerHp !== null
        && currentPlayerHp !== null
        && currentPlayerHp < previousPlayerHp;

      if (opponentTookDamage && !playerTookDamage && combatants?.currentPlayer) {
        return { side: 'player', xuxemon: combatants.currentPlayer };
      }

      if (playerTookDamage && !opponentTookDamage && combatants?.currentOpponent) {
        return { side: 'opponent', xuxemon: combatants.currentOpponent };
      }

      return null;
    };

    if (!attackerContext) {
      const inferredAttacker = inferAttackerFromHpDelta();
      if (inferredAttacker) {
        if (
          attackerCandidates.length === 0
          || attackerCandidates.some((candidate) => candidate.side === inferredAttacker.side)
        ) {
          attackerContext = inferredAttacker;
        }
      }
    }

    if (!attackerContext) {
      return 0;
    }

    const animationKey = `${attackLogData?.index ?? -1}|${attackLog}`;
    if (this.lastBattleAnimationKey === animationKey) {
      return 0;
    }

    this.lastBattleAnimationKey = animationKey;
    const visualType = this.getAttackVisualType(attackerContext.xuxemon, extractedAttackName);
    const attackImpactDelayMs = this.getAttackImpactSyncDelayMs(visualType);
    const barsSyncDelayMs = resolvedRoll !== null
      ? this.diceOverlayDurationMs + 80 + attackImpactDelayMs
      : attackImpactDelayMs;

    this.playBattleAnimationSequence(
      attackerContext.side,
      attackerName,
      resolvedRoll,
      extractedAttackName,
      attackerContext.xuxemon,
    );

    return barsSyncDelayMs;
  }

  // Sirve para retrasar la actualización visual de barras HP hasta que termina la animación del golpe.
  private syncCombatantBarsWithDelay(
    activePlayer: Xuxemon | null,
    activeOpponent: Xuxemon | null,
    delayMs: number,
  ): void {
    if (this.pendingBarsSyncTimeout) {
      clearTimeout(this.pendingBarsSyncTimeout);
      this.pendingBarsSyncTimeout = null;
    }

    const applyBars = () => {
      const player = this.selectedXuxemon() ?? activePlayer;
      const opponent = this.opponentXuxemon() ?? activeOpponent;

      if (player) {
        this.syncPlayerBars(player);
      }
      if (opponent) {
        this.syncOpponentBars(opponent);
      }
    };

    if (delayMs <= 0) {
      applyBars();
      return;
    }

    this.pendingBarsSyncTimeout = setTimeout(() => {
      this.zone.run(() => {
        applyBars();
      });
      this.pendingBarsSyncTimeout = null;
    }, delayMs);
  }

  private playBattleAnimationSequence(
    side: 'player' | 'opponent',
    attackerName: string,
    roll: number | null,
    attackName?: string,
    attackerOverride?: Xuxemon | null,
  ): void {
    void attackerName;
    const attacker = attackerOverride ?? (side === 'player' ? this.selectedXuxemon() : this.opponentXuxemon());
    const attack = this.resolveAttackAnimationDescriptor(attacker, attackName);
    const visualType = this.getAttackVisualType(attacker, attackName ?? attack);

    if (roll !== null) {
      this.playDiceRollAnimation(roll, () => this.queueAttackLunge(side, visualType));
      return;
    }

    if (attack) {
      this.playAttackLunge(side, visualType);
      return;
    }

    this.playAttackLunge(side, visualType);
  }

  // Sirve para mostrar el overlay del dado y fijar el valor final tras la animación de tirada.
  private playDiceRollAnimation(finalRoll: number, onLanded?: () => void): void {
    if (this.diceLandingTimeout) {
      clearTimeout(this.diceLandingTimeout);
    }
    if (this.diceOverlayTimeout) {
      clearTimeout(this.diceOverlayTimeout);
    }

    this.diceContainerAnimation?.cancel();
    this.diceContainerAnimation = null;
    this.diceCubeAnimation?.cancel();
    this.diceCubeAnimation = null;

    this.zone.run(() => {
      this.isDiceOverlayVisible.set(true);
      this.isDiceRolling.set(true);
      this.diceValue.set(null);
      this.diceOutcomeTone.set(null);

      this.flushBattleView();
      this.runDiceOverlayAnimation();

      this.diceLandingTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isDiceRolling.set(false);
          this.diceValue.set(finalRoll);
          this.diceOutcomeTone.set(this.getDiceOutcomeTone(finalRoll));
          this.runDiceLandingAnimation();
        });
        this.diceLandingTimeout = null;
      }, this.diceLandingDurationMs);

      this.diceOverlayTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isDiceOverlayVisible.set(false);
          this.diceOutcomeTone.set(null);
          onLanded?.();
        });
        this.diceOverlayTimeout = null;
      }, this.diceOverlayDurationMs);
    });
  }

  // Sirve para lanzar el dado con una animación programática fiable, sin depender del reinicio de clases CSS.
  private runDiceOverlayAnimation(): void {
    if (!this.isBrowser) {
      return;
    }

    const containerElement = this.diceContainer?.nativeElement;
    const diceElement = this.diceCube?.nativeElement;

    if (!containerElement || !diceElement || typeof containerElement.animate !== 'function' || typeof diceElement.animate !== 'function') {
      return;
    }

    this.diceContainerAnimation = containerElement.animate([
      { transform: 'translate3d(0, 26px, 0) scale(0.84)', opacity: 0, offset: 0 },
      { transform: 'translate3d(0, -6px, 0) scale(1.03)', opacity: 1, offset: 0.38 },
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 1 },
    ], {
      duration: this.diceLandingDurationMs,
      easing: 'cubic-bezier(0.2, 0.92, 0.24, 1)',
      fill: 'both',
    });

    this.diceCubeAnimation = diceElement.animate([
      { transform: 'translate3d(0, -24px, 0) scale(0.78) rotateX(0deg) rotateY(0deg) rotateZ(0deg)', filter: 'brightness(1)', offset: 0 },
      { transform: 'translate3d(0, -8px, 0) scale(1.08) rotateX(440deg) rotateY(380deg) rotateZ(220deg)', filter: 'brightness(1.12)', offset: 0.24 },
      { transform: 'translate3d(0, 4px, 0) scale(0.96) rotateX(980deg) rotateY(820deg) rotateZ(420deg)', filter: 'brightness(1.02)', offset: 0.56 },
      { transform: 'translate3d(0, 2px, 0) scale(1.03) rotateX(1450deg) rotateY(1220deg) rotateZ(620deg)', filter: 'brightness(1.08)', offset: 0.82 },
      { transform: 'translate3d(0, 0, 0) scale(1) rotateX(1760deg) rotateY(1440deg) rotateZ(720deg)', filter: 'brightness(1)', offset: 1 },
    ], {
      duration: this.diceLandingDurationMs,
      easing: 'cubic-bezier(0.18, 0.82, 0.24, 1)',
      fill: 'both',
    });
  }

  // Sirve para rematar visualmente el dado cuando cae y ya se conoce el valor final.
  private runDiceLandingAnimation(): void {
    if (!this.isBrowser) {
      return;
    }

    const containerElement = this.diceContainer?.nativeElement;
    const diceElement = this.diceCube?.nativeElement;

    if (!containerElement || !diceElement || typeof containerElement.animate !== 'function' || typeof diceElement.animate !== 'function') {
      return;
    }

    this.diceContainerAnimation?.cancel();
    this.diceCubeAnimation?.cancel();

    this.diceContainerAnimation = containerElement.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 0 },
      { transform: 'translate3d(0, -2px, 0) scale(1.04)', opacity: 1, offset: 0.32 },
      { transform: 'translate3d(0, 1px, 0) scale(0.99)', opacity: 1, offset: 0.7 },
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 1 },
    ], {
      duration: 260,
      easing: 'cubic-bezier(0.22, 0.92, 0.26, 1)',
      fill: 'both',
    });

    this.diceCubeAnimation = diceElement.animate([
      { transform: 'translate3d(0, -14px, 0) scale(1.12) rotateX(0deg) rotateY(0deg) rotateZ(-8deg)', filter: 'brightness(1.14)', offset: 0 },
      { transform: 'translate3d(0, 8px, 0) scale(0.9) rotateX(0deg) rotateY(0deg) rotateZ(7deg)', filter: 'brightness(0.98)', offset: 0.46 },
      { transform: 'translate3d(0, -4px, 0) scale(1.04) rotateX(0deg) rotateY(0deg) rotateZ(-3deg)', filter: 'brightness(1.08)', offset: 0.72 },
      { transform: 'translate3d(0, 0, 0) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg)', filter: 'brightness(1)', offset: 1 },
    ], {
      duration: 340,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both',
    });
  }

  // Sirve para encadenar la tirada y la animación del ataque según el atacante y el movimiento usado.
  private playDiceThenAttack(
    side: 'player' | 'opponent',
    roll: number,
    attacker: Xuxemon | null,
    attack?: AttackAnimationDescriptor | null,
  ): void {
    const visualType = this.getAttackVisualType(attacker, attack ?? undefined);
    this.playDiceRollAnimation(roll, () => this.queueAttackLunge(side, visualType));
  }

  // Sirve para programar el inicio del ataque justo después de que el dado aterrice.
  private queueAttackLunge(side: 'player' | 'opponent', visualType: AttackVisualType): void {
    if (this.queuedAttackLungeTimeout) {
      clearTimeout(this.queuedAttackLungeTimeout);
    }

    this.queuedAttackLungeTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.playAttackLunge(side, visualType);
      });
      this.queuedAttackLungeTimeout = null;
    }, 80);
  }

  // Sirve para lanzar la animación de acometida del atacante y coordinar trazo e impacto.
  private playAttackLunge(side: 'player' | 'opponent', visualType: AttackVisualType): void {
    this.clearAttackAnimationState(false);
    this.attackVisualType.set(visualType);
    // Visual simplificado: solo movimiento del Xuxemon, sin trail/burst/flash.
    this.runSpriteAttackAnimation(side, visualType);

    const durationMs = this.getAttackAnimationDurationMs(visualType);

    if (side === 'player') {
      this.isPlayerAttacking.set(true);
      this.playerAttackTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isPlayerAttacking.set(false);
          this.resetAttackVisualTypeIfIdle();
        });
        this.playerAttackTimeout = null;
      }, durationMs);
      return;
    }

    this.isOpponentAttacking.set(true);
    this.opponentAttackTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.isOpponentAttacking.set(false);
        this.resetAttackVisualTypeIfIdle();
      });
      this.opponentAttackTimeout = null;
    }, durationMs);
  }

  // Sirve para lanzar la animación de acometida del sprite directamente via Web Animations API para evitar reinicios CSS inconsistentes.
  private runSpriteAttackAnimation(side: 'player' | 'opponent', visualType: AttackVisualType): void {
    if (side === 'player') {
      this.playerSpriteAnimation?.cancel();
      this.playerSpriteAnimation = null;
    } else {
      this.opponentSpriteAnimation?.cancel();
      this.opponentSpriteAnimation = null;
    }

    if (!this.isBrowser) {
      return;
    }

    const el = (side === 'player' ? this.playerSprite : this.opponentSprite)?.nativeElement;
    if (!el || typeof el.animate !== 'function') {
      this.flushBattleView();
      return;
    }

    const lungeX = side === 'player' ? 72 : -72;
    const lungeY = side === 'player' ? -16 : 16;
    const duration = Math.min(this.getAttackAnimationDurationMs(visualType), 520);

    const anim = el.animate(
      [
        { transform: 'translate3d(0, 0, 0) scale(1)', offset: 0 },
        { transform: `translate3d(${lungeX}px, ${lungeY}px, 0) scale(1.08)`, offset: 0.35 },
        { transform: 'translate3d(0, 0, 0) scale(1)', offset: 1 },
      ],
      { duration, easing: 'ease-in-out', fill: 'none' },
    );

    if (side === 'player') {
      this.playerSpriteAnimation = anim;
    } else {
      this.opponentSpriteAnimation = anim;
    }
  }

  // Sirve para activar el trazo de ataque y el burst de impacto con la variante visual correspondiente.
  private playAttackEffects(attackerSide: 'player' | 'opponent', visualType: AttackVisualType): void {
    const targetSide = attackerSide === 'player' ? 'opponent' : 'player';

    if (this.playerHitTimeout) {
      clearTimeout(this.playerHitTimeout);
      this.playerHitTimeout = null;
    }
    if (this.opponentHitTimeout) {
      clearTimeout(this.opponentHitTimeout);
      this.opponentHitTimeout = null;
    }
    if (this.attackTrailTimeout) {
      clearTimeout(this.attackTrailTimeout);
      this.attackTrailTimeout = null;
    }
    if (this.impactBurstTimeout) {
      clearTimeout(this.impactBurstTimeout);
      this.impactBurstTimeout = null;
    }

    this.activeAttackTrail.set(null);
    this.activeImpactBurst.set(null);
    this.isPlayerHit.set(false);
    this.isOpponentHit.set(false);
    this.attackVisualType.set(visualType);
    this.activeAttackTrail.set(attackerSide);
    this.flushBattleView();

    const trailDuration = this.getAttackTrailDurationMs(visualType);
    const impactDelay = this.getImpactDelayMs(visualType);
    const impactDuration = this.getImpactDurationMs(visualType);

    this.attackTrailTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.activeAttackTrail.set(null);
        this.resetAttackVisualTypeIfIdle();
      });
      this.attackTrailTimeout = null;
    }, trailDuration);

    this.impactBurstTimeout = setTimeout(() => {
      this.zone.run(() => {
        this.activeImpactBurst.set(targetSide);

        if (targetSide === 'player') {
          this.isPlayerHit.set(true);
          this.playerHitTimeout = setTimeout(() => {
            this.zone.run(() => {
              this.isPlayerHit.set(false);
              this.activeImpactBurst.set(null);
              this.resetAttackVisualTypeIfIdle();
            });
            this.playerHitTimeout = null;
          }, impactDuration);
        } else {
          this.isOpponentHit.set(true);
          this.opponentHitTimeout = setTimeout(() => {
            this.zone.run(() => {
              this.isOpponentHit.set(false);
              this.activeImpactBurst.set(null);
              this.resetAttackVisualTypeIfIdle();
            });
            this.opponentHitTimeout = null;
          }, impactDuration);
        }

        this.flushBattleView();
      });
      this.impactBurstTimeout = null;
    }, impactDelay);
  }

  // Sirve para limpiar la traza, el burst y los flags del último ataque antes de iniciar uno nuevo o al destruir.
  private clearAttackAnimationState(resetVisualType = true): void {
    if (this.queuedAttackLungeTimeout) {
      clearTimeout(this.queuedAttackLungeTimeout);
      this.queuedAttackLungeTimeout = null;
    }
    if (this.playerAttackTimeout) {
      clearTimeout(this.playerAttackTimeout);
      this.playerAttackTimeout = null;
    }
    if (this.opponentAttackTimeout) {
      clearTimeout(this.opponentAttackTimeout);
      this.opponentAttackTimeout = null;
    }
    if (this.attackTrailTimeout) {
      clearTimeout(this.attackTrailTimeout);
      this.attackTrailTimeout = null;
    }
    if (this.impactBurstTimeout) {
      clearTimeout(this.impactBurstTimeout);
      this.impactBurstTimeout = null;
    }
    if (this.playerHitTimeout) {
      clearTimeout(this.playerHitTimeout);
      this.playerHitTimeout = null;
    }
    if (this.opponentHitTimeout) {
      clearTimeout(this.opponentHitTimeout);
      this.opponentHitTimeout = null;
    }

    this.isPlayerAttacking.set(false);
    this.isOpponentAttacking.set(false);
    this.activeAttackTrail.set(null);
    this.activeImpactBurst.set(null);
    this.isPlayerHit.set(false);
    this.isOpponentHit.set(false);

    if (resetVisualType) {
      this.attackVisualType.set('neutral');
    }
  }

  // Sirve para volver a neutral cuando ya no quedan efectos visuales activos del ataque.
  private resetAttackVisualTypeIfIdle(): void {
    if (
      this.activeAttackTrail()
      || this.activeImpactBurst()
      || this.isPlayerAttacking()
      || this.isOpponentAttacking()
      || this.isPlayerHit()
      || this.isOpponentHit()
    ) {
      return;
    }

    this.attackVisualType.set('neutral');
  }

  // Sirve para resolver el descriptor del ataque a partir del atacante y el nombre presente en el log del snapshot.
  private resolveAttackAnimationDescriptor(
    attacker: Xuxemon | null,
    attackName?: string,
  ): AttackAnimationDescriptor | undefined {
    const normalizedAttackName = attackName?.trim().toLowerCase();
    if (!attacker || !normalizedAttackName) {
      return undefined;
    }

    return attacker.attacks?.find((attack) => attack.name?.trim().toLowerCase() === normalizedAttackName);
  }

  // Sirve para decidir qué familia visual usa el ataque actual y si debe activar la variante especial.
  private getAttackVisualType(
    attacker: Xuxemon | null,
    attack?: AttackAnimationDescriptor | string,
  ): AttackVisualType {
    const baseType = this.getBaseAttackVisualType(attacker, attack);
    const descriptor = typeof attack === 'string' ? this.resolveAttackAnimationDescriptor(attacker, attack) : attack;

    if ((descriptor?.status_chance ?? 0) > 0) {
      return `${baseType}-special` as AttackVisualType;
    }

    return baseType;
  }

  // Sirve para mapear el estilo del golpe a partir del tipo elemental o, en fallback, del perfil del ataque.
  private getBaseAttackVisualType(
    attacker: Xuxemon | null,
    attack?: AttackAnimationDescriptor | string,
  ): Exclude<AttackVisualType, 'speed-special' | 'technical-special' | 'power-special' | 'neutral'> {
    const elementalType = attacker?.type?.name?.trim().toLowerCase() ?? '';
    if (elementalType === 'aire') {
      return 'speed';
    }
    if (elementalType === 'aigua') {
      return 'technical';
    }
    if (elementalType === 'terra') {
      return 'power';
    }

    const descriptor = typeof attack === 'string' ? this.resolveAttackAnimationDescriptor(attacker, attack) : attack;
    const attackDamage = descriptor?.dmg ?? 0;
    if ((descriptor?.status_chance ?? 0) > 0) {
      return 'technical';
    }
    if (attackDamage >= 18) {
      return 'power';
    }
    if (attackDamage > 0 && attackDamage <= 10) {
      return 'speed';
    }

    return 'technical';
  }

  // Sirve para mantener la duración del trazo alineada con los keyframes CSS de cada variante.
  private getAttackTrailDurationMs(visualType: AttackVisualType): number {
    switch (visualType) {
      case 'speed-special':
        return 360;
      case 'technical-special':
        return 460;
      case 'power-special':
        return 400;
      case 'speed':
        return 420;
      case 'technical':
        return 480;
      case 'power':
        return 520;
      default:
        return 420;
    }
  }

  // Sirve para retrasar el burst al instante en que el atacante ya ha avanzado visualmente.
  private getImpactDelayMs(visualType: AttackVisualType): number {
    switch (visualType) {
      case 'speed-special':
      case 'speed':
        return 170;
      case 'technical-special':
      case 'technical':
        return 220;
      case 'power-special':
      case 'power':
        return 260;
      default:
        return 200;
    }
  }

  // Sirve para mantener el burst y el flash el tiempo justo antes de limpiar la clase visual.
  private getImpactDurationMs(visualType: AttackVisualType): number {
    switch (visualType) {
      case 'speed-special':
      case 'technical-special':
      case 'power-special':
        return 420;
      case 'speed':
      case 'technical':
      case 'power':
        return 360;
      default:
        return 340;
    }
  }

  // Retraso para aplicar daño en práctica: overlay + cola + impacto.
  private getPracticeDamageApplyDelayMs(visualType: AttackVisualType): number {
    const queueAfterOverlayMs = 80;
    return this.diceOverlayDurationMs + queueAfterOverlayMs + this.getImpactDelayMs(visualType) + 120;
  }

  // Sirve para desactivar el estado attacking cuando el keyframe principal del atacante ya ha terminado.
  private getAttackAnimationDurationMs(visualType: AttackVisualType): number {
    switch (visualType) {
      case 'speed-special':
        return 460;
      case 'technical-special':
        return 560;
      case 'power-special':
        return 620;
      case 'speed':
        return 480;
      case 'technical':
        return 540;
      case 'power':
        return 580;
      default:
        return 500;
    }
  }

  // Sirve para sincronizar el daño visual en el frame de impacto (avance máximo del lunge), no al final completo.
  private getAttackImpactSyncDelayMs(visualType: AttackVisualType): number {
    const spriteLungeDurationMs = Math.min(this.getAttackAnimationDurationMs(visualType), 520);
    return Math.round(spriteLungeDurationMs * 0.35);
  }

  // Sirve para reproducir la secuencia corta de debilitamiento de un bando y ejecutar un callback al terminar.
  private playFaintAnimation(side: 'player' | 'opponent', onComplete?: () => void): void {
    if (side === 'player') {
      if (this.playerFaintTimeout) {
        clearTimeout(this.playerFaintTimeout);
      }
      this.isPlayerFainting.set(true);
      this.playerFaintTimeout = setTimeout(() => {
        this.isPlayerFainting.set(false);
        this.playerFaintTimeout = null;
        onComplete?.();
      }, 730);
      return;
    }

    if (this.opponentFaintTimeout) {
      clearTimeout(this.opponentFaintTimeout);
    }
    this.isOpponentFainting.set(true);
    this.opponentFaintTimeout = setTimeout(() => {
      this.isOpponentFainting.set(false);
      this.opponentFaintTimeout = null;
      onComplete?.();
    }, 730);
  }

  // Sirve para mostrar un mensaje destacado temporal (eficacia, bonos) sobre el campo de batalla.
  private showBattleCallout(text: string, tone: 'buff' | 'nerf' | 'neutral'): void {
    this.battleCallout.set({ text, tone });
    this.flushBattleView();

    if (this.battleCalloutTimeout) {
      clearTimeout(this.battleCalloutTimeout);
    }

    this.battleCalloutTimeout = setTimeout(() => {
      this.battleCallout.set(null);
      this.battleCalloutTimeout = null;
      this.flushBattleView();
    }, 1300);
  }

  // Sirve para forzar la detección de cambios cuando las animaciones o señales lo requieren al instante.
  private flushBattleView(): void {
    this.cdr.detectChanges();
  }

  // Sirve para iniciar o reanudar la música de fondo del combate si la vista y el estado lo permiten.
  private startBattleMusic(): void {
    const audio = this.battleMusic?.nativeElement;
    if (!audio || !this.isBrowser || this.battleStatus() === 'finished') {
      return;
    }

    audio.loop = true;
    audio.volume = 0.6;

    if (!audio.paused) {
      return;
    }

    audio.play().catch((error) => {
      console.warn('Battle music playback prevented by browser policy', error);
    });
  }

  // Sirve para abrir el canal SSE del combate y delegar en polling si no llega snapshot a tiempo.
  private openBattleStream(): boolean {
    const battleId = this.battleId();
    const token = this.auth.getToken();

    if (!battleId || !this.isBrowser || typeof EventSource === 'undefined' || !token) {
      return false;
    }

    this.closeBattleStream();

    const stream = this.battleService.connectBattleStream(battleId, token);
    if (!stream) {
      return false;
    }

    let receivedSnapshot = false;
    this.realtimeStatus.set('syncing');

    this.streamBootstrapTimeout = setTimeout(() => {
      if (receivedSnapshot) {
        return;
      }

      this.closeBattleStream();
      this.startPolling();
    }, 2500);

    stream.addEventListener('battle', (event: Event) => {
      const message = event as MessageEvent<string>;
      this.zone.run(() => {
        receivedSnapshot = true;
        this.clearStreamBootstrapTimeout();
        this.stopPolling();
        this.realtimeStatus.set('live');
        this.handleRealtimeBattlePayload(message.data);
      });
    });

    stream.onerror = () => {
      this.zone.run(() => {
        this.closeBattleStream();
        this.startPolling();
      });
    };

    this.battleEventSource = stream;
    return true;
  }

  // Sirve para parsear un mensaje en vivo del stream y aplicar estado, música y fin de batalla si aplica.
  private handleRealtimeBattlePayload(rawPayload: string): void {
    try {
      const data = JSON.parse(rawPayload);
      const wasFinished = this.battleStatus() === 'finished';
      this.applyBattleSnapshot(data);
      this.startBattleMusic();

      if (data.winner_id && !wasFinished) {
        this.handleExternallyFinishedBattle(data);
      }
    } catch (error) {
      console.warn('Could not parse battle stream payload', error);
    }
  }

  // Sirve para detener por completo la sincronización (intervalo y EventSource).
  private stopBattleSync(): void {
    this.stopPolling();
    this.closeBattleStream();
  }

  // Sirve para cancelar el intervalo de peticiones periódicas al backend.
  private stopPolling(): void {
    if (!this.pollingInterval) {
      return;
    }

    clearInterval(this.pollingInterval);
    this.pollingInterval = null;
  }

  // Sirve para volver a encender el polling solo cuando no hay conexión SSE activa.
  private restartPolling(): void {
    if (this.battleEventSource) {
      return;
    }

    this.stopPolling();
    this.startPolling();
  }

  // Sirve para cerrar el EventSource y limpiar el temporizador de arranque del stream.
  private closeBattleStream(): void {
    this.clearStreamBootstrapTimeout();

    if (!this.battleEventSource) {
      return;
    }

    this.battleEventSource.close();
    this.battleEventSource = null;
  }

  // Sirve para anular el timeout de espera del primer mensaje del stream SSE.
  private clearStreamBootstrapTimeout(): void {
    if (!this.streamBootstrapTimeout) {
      return;
    }

    clearTimeout(this.streamBootstrapTimeout);
    this.streamBootstrapTimeout = null;
  }

  // Sirve para espaciar más el polling cuando la pestaña está en segundo plano.
  private getPollingIntervalMs(): number {
    if (!this.isBrowser) {
      return 3000;
    }

    return document.visibilityState === 'visible' ? 3000 : 6500;
  }

  // Sirve para pausar y reiniciar la pista de música del combate al salir o terminar.
  private stopBattleMusic(): void {
    const audio = this.battleMusic?.nativeElement;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }

  // Sirve para mantener seleccionado el mismo Xuxemon tras refrescos del equipo.
  private refreshSelectedFromTeam(team: Xuxemon[]): void {
    const currentId = this.selectedXuxemon()?.adquired_id;
    if (!currentId) {
      return;
    }

    const updatedSelection = team.find((xuxemon) => xuxemon.adquired_id === currentId);
    if (!updatedSelection) {
      return;
    }

    this.selectedXuxemon.set(updatedSelection);
    this.syncPlayerBars(updatedSelection);
  }

  // Sirve para generar un equipo rival aleatorio en modo práctica a partir del catálogo de Xuxemons.
  private pickPracticeOpponentTeam(): void {
    void this.xuxemonService.loadAllXuxemons();
    this.subs.add(
      this.xuxemonService.xuxemonsList.pipe(take(1)).subscribe((all: Xuxemon[]) => {
        if (all.length === 0) {
          return;
        }

        const prepared = [...all]
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(3, all.length))
          .map((xuxemon) => ({
            ...xuxemon,
            current_hp: xuxemon.hp ?? 100,
          }));

        this.opponentTeam.set(prepared);
        const firstOpponent = this.getFirstAlive(prepared);
        if (firstOpponent) {
          this.opponentXuxemon.set(firstOpponent);
          this.syncOpponentBars(firstOpponent);
          this.addLog(`Battle starts! vs ${firstOpponent.name}`, 'system');
          if (this.selectedXuxemon()) {
            this.battleStatus.set('ready');
          }
        }
      }),
    );
  }

  // Sirve para sustituir al rival debilitado por el siguiente vivo o declarar victoria del jugador.
  private handleOpponentFaint(): void {
    const currentOpponent = this.opponentXuxemon();
    if (!currentOpponent) {
      return;
    }

    this.addLog(`${currentOpponent.name} fainted!`, 'opponent');
    const nextOpponent = this.getFirstAlive(
      this.opponentTeam().filter((xuxemon) => !this.isSameXuxemon(xuxemon, currentOpponent)),
    );

    this.playFaintAnimation('opponent', () => {
      if (!nextOpponent) {
        this.finishBattle(true);
        return;
      }

      this.opponentXuxemon.set(nextOpponent);
      this.syncOpponentBars(nextOpponent);
      this.addLog(`${this.opponentTrainerName()} sent out a Xuxemon!`, 'opponent');
      this.currentTurn.set('opponent');
      this.battleStatus.set('ready');
      setTimeout(() => this.opponentTurn(), 1200);
    });
  }

  // Sirve para forzar cambio de Xuxemon o derrota cuando el combatiente del jugador cae a 0 HP.
  private handlePlayerFaint(): void {
    const currentPlayer = this.selectedXuxemon();
    if (!currentPlayer) {
      return;
    }

    this.addLog(`${currentPlayer.name} fainted!`, 'player');
    const backups = this.getSwitchCandidates();

    this.playFaintAnimation('player', () => {
      if (backups.length === 0) {
        this.finishBattle(false);
        return;
      }

      this.forcedSwitch.set(true);
      this.currentTurn.set('player');
      this.switchPage.set(0);
      this.currentSubMenu.set('switch');
      this.battleStatus.set('ready');
      this.addLog('Choose another Xuxemon to continue the battle.', 'system');
    });
  }

  // Sirve para reaccionar cuando el backend marca la batalla terminada (victoria, derrota o huida).
  private handleExternallyFinishedBattle(data: any): void {
    const userId = this.auth.getUser()?.id;
    const playerWon = this.sameId(data.winner_id, userId);
    this.battleStatus.set('finished');
    this.stopBattleSync();

    if (data.completion_reason === 'runaway') {
      if (this.sameId(data.runner_id, userId)) {
        this.runawayResultMessage.set('You ran away from the battle.');
      } else {
        this.runawayResultMessage.set('Your rival ran away from the battle.');
        this.refreshAuthenticatedUserStats();
      }

      this.showRunawayResultModal.set(true);
      return;
    }

    if (playerWon) {
      this.addLog('The battle ended in your favor.', 'system');
      this.refreshAuthenticatedUserStats();
      this.presentVictoryFlow();
      return;
    }

    this.addLog('The battle has already been completed.', 'system');
    setTimeout(() => this.router.navigate(['/friends']), 1200);
  }

  // Sirve para leer el HP actual de un Xuxemon con un valor numérico seguro no negativo.
  private getCurrentHpValue(xuxemon: Xuxemon): number {
    return Math.max(0, xuxemon.current_hp ?? xuxemon.hp ?? 0);
  }

  // Sirve para actualizar las señales de barra de HP del jugador según un Xuxemon concreto.
  private syncPlayerBars(xuxemon: Xuxemon): void {
    const maxHp = xuxemon.hp || 100;
    const currentHp = this.getCurrentHpValue(xuxemon);
    this.playerMaxHP.set(maxHp);
    this.playerHP.set(maxHp > 0 ? (currentHp / maxHp) * 100 : 0);
  }

  // Sirve para actualizar las señales de barra de HP del rival según su Xuxemon activo.
  private syncOpponentBars(xuxemon: Xuxemon): void {
    const maxHp = xuxemon.hp || 100;
    const currentHp = this.getCurrentHpValue(xuxemon);
    this.opponentMaxHP.set(maxHp);
    this.opponentHP.set(maxHp > 0 ? (currentHp / maxHp) * 100 : 0);
  }

  // Sirve para persistir en señales y lista el nuevo HP del Xuxemon activo del jugador.
  private updateMyTeamHp(target: Xuxemon, currentHp: number): void {
    const updated = { ...target, current_hp: currentHp };
    this.selectedXuxemon.set(updated);
    this.replaceMyTeamMember(updated);
  }

  // Sirve para actualizar el rival activo y su entrada en el array del equipo contrario.
  private updateOpponentTeamHp(target: Xuxemon, currentHp: number): void {
    const updated = { ...target, current_hp: currentHp };
    this.opponentXuxemon.set(updated);
    this.opponentTeam.update((team) => team.map((xuxemon) => {
      if (xuxemon.adquired_id && target.adquired_id) {
        return xuxemon.adquired_id === target.adquired_id ? updated : xuxemon;
      }
      return xuxemon.id === target.id ? updated : xuxemon;
    }));
  }

  // Sirve para sustituir un miembro del equipo propio en la señal `myXuxemons` tras un cambio de datos.
  private replaceMyTeamMember(updated: Xuxemon): void {
    this.myXuxemons.update((team) => team.map((xuxemon) => xuxemon.adquired_id === updated.adquired_id ? updated : xuxemon));
  }

  // Sirve para obtener el primer Xuxemon con HP positivo de una lista (p. ej. siguiente en combate).
  private getFirstAlive(team: Xuxemon[]): Xuxemon | null {
    return team.find((xuxemon) => this.getCurrentHpValue(xuxemon) > 0) ?? null;
  }

  // Sirve para comparar dos Xuxemons por `adquired_id` o por `id` de plantilla según lo disponible.
  private isSameXuxemon(left: Xuxemon, right: Xuxemon): boolean {
    if (left.adquired_id !== undefined || right.adquired_id !== undefined) {
      return left.adquired_id === right.adquired_id;
    }

    return left.id === right.id;
  }

  // Sirve para obtener la lista de Xuxemons del rival que pueden robarse tras ganar.
  private getStealOptions(): Xuxemon[] {
    const data = this.battleData();
    const options = (data?.opponent_available_xuxemons ?? this.opponentTeam()) as Xuxemon[];
    return options.filter((xuxemon) => xuxemon.adquired_id !== undefined);
  }

  // Sirve para resolver el identificador de usuario del rival según si somos dueños o invitados de la batalla.
  private getOpponentUserId(): string | null {
    const data = this.battleData();
    const userId = this.auth.getUser()?.id;
    if (!data || !userId) {
      return null;
    }
    return this.sameId(data.user_id, userId) ? String(data.opponent_user_id) : String(data.user_id);
  }

  // Sirve para intentar aplicar el estado alterado de un ataque según probabilidad y reglas de combate.
  private applyAttackStatusEffectToTarget(
    xuxemon: Xuxemon,
    attackObj: { status_chance?: number | null; statusEffect?: { name: string; icon_url: string } },
    side: BattleLogSource = 'system',
  ): Xuxemon {
    const statusChance = attackObj.status_chance ?? 0;

    if (!attackObj.statusEffect?.name || !statusChance || xuxemon.statusEffect?.name || this.getCurrentHpValue(xuxemon) <= 0) {
      return xuxemon;
    }

    if ((Math.random() * 100) > statusChance) {
      return xuxemon;
    }

    this.addLog(`${xuxemon.name} is now affected by ${attackObj.statusEffect.name}!`, side);

    const appliedKey = attackObj.statusEffect.name.trim().toLowerCase();
    // TAREA 6: paralysis y confusion duran exactamente 3 turnos.
    const status_effect_turns = appliedKey === 'paralysis' || appliedKey === 'paralyzed' || appliedKey === 'confusion' || appliedKey === 'confused' ? 3 : undefined;

    return {
      ...xuxemon,
      statusEffect: attackObj.statusEffect,
      status_effect_turns,
    };
  }

  // Sirve para abrir robo, victoria directa o modal de práctica según el tipo de batalla y premios.
  private presentVictoryFlow(): void {
    this.showConfetti.set(true);

    if (!this.isPractice()) {
      const options = this.getStealOptions();
      if (options.length > 0) {
        this.stealOptions.set(options);
        this.showStealModal.set(true);
        return;
      }

      this.skipPrizeSelection();
      return;
    }

    this.showVictoryModal.set(true);
  }

  // Sirve para validar si un objeto de estado puede aplicarse a un objetivo concreto (Nulberry, setas, etc.).
  private canUseStatusItemOnTarget(item: InventoryItem, xuxemon: Xuxemon): boolean {
    const hasStatus = Boolean(xuxemon.statusEffect?.name);
    const hasSideEffect = Boolean(xuxemon.side_effect_1?.name || xuxemon.side_effect_2?.name || xuxemon.side_effect_3?.name);

    if (item.name === 'Nulberry') {
      return hasStatus || hasSideEffect;
    }
    if (item.name === 'Yellow Mushroom') {
      return [xuxemon.side_effect_1?.name, xuxemon.side_effect_2?.name, xuxemon.side_effect_3?.name].includes('Gluttony');
    }
    if (item.name === 'Red Mushroom') {
      return [xuxemon.side_effect_1?.name, xuxemon.side_effect_2?.name, xuxemon.side_effect_3?.name].includes('Starving');
    }

    return hasStatus;
  }

  // Sirve para fusionar la respuesta del servidor de uso de objeto con el modelo local del Xuxemon.
  private applyItemResponseToXuxemon(xuxemon: Xuxemon | null, data?: UseItemResponseData, item?: InventoryItem | null): Xuxemon | null {
    if (!xuxemon || !data) {
      return xuxemon;
    }

    let statusEffect = xuxemon.statusEffect;
    let sideEffect1 = xuxemon.side_effect_1;
    let sideEffect2 = xuxemon.side_effect_2;
    let sideEffect3 = xuxemon.side_effect_3;

    if (item?.effect_type === 'Remove Status Effects') {
      if (item.name === 'Nulberry') {
        statusEffect = undefined;
        sideEffect1 = undefined;
        sideEffect2 = undefined;
        sideEffect3 = undefined;
      } else if (item.name === 'Yellow Mushroom') {
        sideEffect1 = this.clearNamedSideEffect(sideEffect1, 'Gluttony');
        sideEffect2 = this.clearNamedSideEffect(sideEffect2, 'Gluttony');
        sideEffect3 = this.clearNamedSideEffect(sideEffect3, 'Gluttony');
      } else if (item.name === 'Red Mushroom') {
        sideEffect1 = this.clearNamedSideEffect(sideEffect1, 'Starving');
        sideEffect2 = this.clearNamedSideEffect(sideEffect2, 'Starving');
        sideEffect3 = this.clearNamedSideEffect(sideEffect3, 'Starving');
      } else {
        statusEffect = undefined;
      }
    }

    return {
      ...xuxemon,
      current_hp: data.current_hp ?? xuxemon.current_hp,
      attack: data.current_attack ?? xuxemon.attack,
      defense: data.current_defense ?? xuxemon.defense,
      size: data.xuxemon_size ?? xuxemon.size,
      requirement_progress: data.requirement_progress ?? xuxemon.requirement_progress,
      statusEffect,
      side_effect_1: sideEffect1,
      side_effect_2: sideEffect2,
      side_effect_3: sideEffect3,
    };
  }

  // Sirve para aplicar un objeto que altera estados al rival vía API de batalla, acción enlazada o práctica.
  private useStatusItemOnTarget(item: InventoryItem, target: Xuxemon): void {
    const battleId = this.battleId();

    if (!battleId) {
      this.usePracticeStatusItem(item, target);
      return;
    }

    if (!this.isPractice()) {
      this.submitLinkedBattleAction({
        action_type: 'use_item',
        bag_item_id: item.bag_item_id,
        target_adquired_xuxemon_id: target.adquired_id,
      });
      return;
    }

    this.subs.add(
      this.battleService.useBattleItem(battleId, item.bag_item_id!, target.adquired_id!).subscribe({
        next: (response: { data?: UseItemResponseData }) => {
          const updatedOpponent = this.applyStatusEffectToXuxemon(target, response.data);
          if (updatedOpponent) {
            this.updateOpponentStateAfterItem(updatedOpponent);
          }

          this.addLog(`You used ${item.name} on ${target.name}!`, 'player');
          void this.xuxemonService.loadMyXuxemons();

          setTimeout(() => {
            this.selectedBattleItem.set(null);
            this.currentSubMenu.set(null);
            this.endTurn();
          }, 800);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Failed to use battle item.';
          this.addLog(`Error: ${message}`, 'system');
          this.battleStatus.set('ready');
        },
      }),
    );
  }

  // Sirve para la variante de práctica que usa el endpoint de ítems de entrenamiento sin batalla enlazada.
  private usePracticeStatusItem(item: InventoryItem, target: Xuxemon): void {
    this.subs.add(
      this.battleService.usePracticeItem(item.bag_item_id!).subscribe({
        next: (response: { data?: UseItemResponseData }) => {
          const updatedOpponent = this.applyStatusEffectToXuxemon(target, response.data);
          this.updateOpponentStateAfterItem(updatedOpponent);
          this.addLog(`You used ${item.name} on ${target.name}!`, 'player');
          this.inventoryService.loadInventory();

          setTimeout(() => {
            this.selectedBattleItem.set(null);
            this.currentSubMenu.set(null);
            this.endTurn();
          }, 800);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Failed to use practice item.';
          this.addLog(`Error: ${message}`, 'system');
          this.battleStatus.set('ready');
        },
      }),
    );
  }

  // Sirve para construir el `statusEffect` del Xuxemon a partir del payload de uso de objeto.
  private applyStatusEffectToXuxemon(xuxemon: Xuxemon, data?: UseItemResponseData): Xuxemon {
    const rawStatusEffect = data?.applied_status_effect;
    if (!rawStatusEffect?.name) {
      return xuxemon;
    }

    const statusEffect = {
      name: rawStatusEffect.name,
      icon_url: rawStatusEffect.icon_url ?? this.auth.getAssetUrl(`/${rawStatusEffect.icon_path ?? ''}`),
    };

    const itemStatusKey = statusEffect.name.trim().toLowerCase();
    // TAREA 6: paralysis y confusion duran 3 turnos.
    const status_effect_turns =
      itemStatusKey === 'paralysis' || itemStatusKey === 'paralyzed' || itemStatusKey === 'confusion' || itemStatusKey === 'confused' ? 3 : undefined;

    return {
      ...xuxemon,
      statusEffect,
      status_effect_turns,
    };
  }

  // Sirve para reflejar en rival activo y en su equipo el Xuxemon actualizado tras un ítem.
  private updateOpponentStateAfterItem(updatedOpponent: Xuxemon): void {
    this.opponentXuxemon.set(updatedOpponent);
    this.opponentTeam.update((team) => team.map((xuxemon) => this.isSameXuxemon(xuxemon, updatedOpponent) ? updatedOpponent : xuxemon));
  }

  // TAREA 6: comprueba si sueño, parálisis o confusión impiden el ataque y aplica sus efectos.
  // Paralysis y Confusion: 3 turnos, 50% fallo. Confusion: autodaño 12% HP total si falla.
  // Sleep: no puede atacar, despierta al recibir daño.
  private resolveStatusBeforeAttack(xuxemon: Xuxemon, side: 'player' | 'opponent'): { prevented: boolean; keepTurn?: boolean } {
    const statusName = normalizedStatusName(xuxemon.statusEffect?.name);

    if (statusName === 'sleep') {
      this.addLog(`${xuxemon.name} is fast asleep and cannot attack!`, side);
      if (side === 'player') {
        return { prevented: true, keepTurn: true };
      }
      this.finishBlockedTurn(side);
      return { prevented: true };
    }

    if (statusName === 'paralysis' || statusName === 'paralyzed') {
      const withTurns = this.ensureBattleStatusTurns(xuxemon, 3);

      if (Math.random() < 0.5) {
        this.addLog(`${withTurns.name} is paralyzed and cannot move!`, side);
        const afterTick = this.tickBattleStatusTurns(withTurns);
        // TAREA 5: mensaje de fin de debuff al expirar.
        if (!afterTick.statusEffect) {
          this.addLog(`${withTurns.name} is no longer paralyzed`, side);
        }
        this.persistXuxemonAfterStatusTick(afterTick, side);
        this.finishBlockedTurn(side);
        return { prevented: true };
      }

      const afterTick = this.tickBattleStatusTurns(withTurns);
      if (!afterTick.statusEffect) {
        this.addLog(`${withTurns.name} is no longer paralyzed`, side);
      }
      this.persistXuxemonAfterStatusTick(afterTick, side);
      return { prevented: false };
    }

    if (statusName === 'confusion' || statusName === 'confused') {
      const withTurns = this.ensureBattleStatusTurns(xuxemon, 3);

      if (Math.random() < 0.5) {
        const maxHp = withTurns.hp || 100;
        const currentHp = this.getCurrentHpValue(withTurns);
        // TAREA 6: autodaño confusión = 12% HP total.
        const selfHitDamage = Math.max(1, Math.round(maxHp * 0.12));
        const newHpValue = Math.max(0, currentHp - selfHitDamage);
        const damaged = { ...withTurns, current_hp: newHpValue };
        const afterTick = this.tickBattleStatusTurns(damaged);

        this.addLog(`${withTurns.name} is confused and hurt itself!`, side);
        // TAREA 5: mensaje de fin de debuff al expirar.
        if (!afterTick.statusEffect) {
          this.addLog(`${withTurns.name} is no longer confused`, side);
        }
        this.applySelfDamageFromStatus(afterTick, side, newHpValue);
        return { prevented: true };
      }

      const afterTick = this.tickBattleStatusTurns(withTurns);
      if (!afterTick.statusEffect) {
        this.addLog(`${withTurns.name} is no longer confused`, side);
      }
      this.persistXuxemonAfterStatusTick(afterTick, side);
      return { prevented: false };
    }

    return { prevented: false };
  }

  // Sirve para inicializar el contador de turnos de Paralysis/Confusion en datos antiguos sin contador.
  private ensureBattleStatusTurns(xuxemon: Xuxemon, defaultTurns: number): Xuxemon {
    const statusName = normalizedStatusName(xuxemon.statusEffect?.name);
    const isCountedStatus = statusName === 'paralysis' || statusName === 'paralyzed'
      || statusName === 'confusion' || statusName === 'confused';
    if (!isCountedStatus || xuxemon.status_effect_turns != null) {
      return xuxemon;
    }

    return { ...xuxemon, status_effect_turns: defaultTurns };
  }

  // Sirve para reducir en uno los turnos restantes de Paralysis/Confusion y limpiar el estado al llegar a cero.
  private tickBattleStatusTurns(xuxemon: Xuxemon): Xuxemon {
    const statusName = normalizedStatusName(xuxemon.statusEffect?.name);
    const isCountedStatus = statusName === 'paralysis' || statusName === 'paralyzed'
      || statusName === 'confusion' || statusName === 'confused';
    if (!isCountedStatus) {
      return xuxemon;
    }

    let turns = xuxemon.status_effect_turns ?? 0;
    if (turns <= 0) {
      return xuxemon;
    }

    turns--;
    if (turns <= 0) {
      return { ...xuxemon, statusEffect: undefined, status_effect_turns: undefined };
    }

    return { ...xuxemon, status_effect_turns: turns };
  }

  // Sirve para persistir el Xuxemon tras tick de parálisis/confusión en el estado local de batalla.
  private persistXuxemonAfterStatusTick(xuxemon: Xuxemon, side: 'player' | 'opponent'): void {
    if (side === 'player') {
      this.selectedXuxemon.set(xuxemon);
      this.replaceMyTeamMember(xuxemon);
      return;
    }

    this.opponentXuxemon.set(xuxemon);
    this.opponentTeam.update((team) => team.map((member) => (this.isSameXuxemon(member, xuxemon) ? xuxemon : member)));
  }

  // Sirve para devolver el turno al otro bando cuando un estado impide completar la acción.
  private finishBlockedTurn(side: 'player' | 'opponent'): void {
    setTimeout(() => {
      if (side === 'player') {
        this.currentTurn.set('opponent');
        this.battleStatus.set('ready');
        setTimeout(() => this.opponentTurn(), this.isPractice() ? 1200 : 1600);
        return;
      }

      this.currentTurn.set('player');
      this.battleStatus.set('ready');
    }, 500);
  }

  // Sirve para aplicar daño por confusión y encadenar debilitamiento o cambio de turno.
  private applySelfDamageFromStatus(xuxemon: Xuxemon, side: 'player' | 'opponent', newHpValue: number): void {
    if (side === 'player') {
      this.updateMyTeamHp(xuxemon, newHpValue);
      if (xuxemon.adquired_id) {
        this.subs.add(this.xuxemonService.updateCurrentHp(xuxemon.adquired_id, newHpValue).subscribe());
      }
      this.syncPlayerBars({ ...xuxemon, current_hp: newHpValue });

      setTimeout(() => {
        if (newHpValue <= 0) {
          this.handlePlayerFaint();
          return;
        }

        this.finishBlockedTurn('player');
      }, 450);
      return;
    }

    this.updateOpponentTeamHp(xuxemon, newHpValue);
    this.syncOpponentBars({ ...xuxemon, current_hp: newHpValue });

    setTimeout(() => {
      if (newHpValue <= 0) {
        this.handleOpponentFaint();
        return;
      }

      this.finishBlockedTurn('opponent');
    }, 450);
  }

  // Sirve para quitar el estado alterado principal tras efectos como el despertar por daño.
  private clearStatusEffect(xuxemon: Xuxemon, side: 'player' | 'opponent'): void {
    const updated = { ...xuxemon, statusEffect: undefined, status_effect_turns: undefined };

    if (side === 'player') {
      this.selectedXuxemon.set(updated);
      this.replaceMyTeamMember(updated);
      return;
    }

    this.updateOpponentStateAfterItem(updated);
  }

  // Sirve para eliminar un efecto lateral concreto del modelo si coincide con el nombre buscado.
  private clearNamedSideEffect(
    sideEffect: Xuxemon['side_effect_1'] | undefined,
    effectName: string,
  ): Xuxemon['side_effect_1'] | undefined {
    return sideEffect?.name === effectName ? undefined : sideEffect;
  }

  // Sirve para enviar al backend el uso de objeto aliado o delegar en el flujo de estados rivales.
  private submitLinkedBattleItemAction(item: InventoryItem, target: Xuxemon): void {
    if (item.effect_type === 'Apply Status Effects') {
      this.useStatusItemOnTarget(item, target);
      return;
    }

    this.submitLinkedBattleAction({
      action_type: 'use_ally_item',
      bag_item_id: item.bag_item_id,
      target_adquired_xuxemon_id: target.adquired_id,
    });
  }

  // Sirve para rendirse en batalla enlazada o salir de práctica cuando no hay `battleId`.
  private submitForfeit(): void {
    const battleId = this.battleId();
    if (!battleId) {
      this.isSubmittingRun.set(false);
      this.stopBattleMusic();
      this.router.navigate(['/friends']);
      return;
    }

    this.subs.add(
      this.battleService.forfeit(battleId).subscribe({
        next: (data: any) => {
          this.disconnectForfeitSent = Boolean(data?.winner_id);
          this.isSubmittingRun.set(false);
          this.applyBattleSnapshot(data);
          if (data.completion_reason === 'runaway') {
            this.runawayResultMessage.set('You ran away from the battle.');
            this.showRunawayResultModal.set(true);
          }
        },
        error: () => {
          this.isSubmittingRun.set(false);
          this.stopBattleMusic();
          this.router.navigate(['/friends']);
        },
      }),
    );
  }

  // Sirve para notificar al servidor la rendición al cerrar pestaña o navegar fuera si corresponde.
  private autoForfeitOnExit(): void {
    if (!this.shouldAutoForfeitOnExit()) {
      return;
    }

    const battleId = this.battleId();
    const token = this.auth.getToken();
    if (!battleId || !token) {
      return;
    }

    this.disconnectForfeitSent = true;
    this.battleService.autoForfeitOnDisconnect(battleId, token);
  }

  // Sirve para decidir si debe enviarse rendición automática al abandonar la página.
  private shouldAutoForfeitOnExit(): boolean {
    const battleId = this.battleId();
    const battleData = this.battleData();

    return this.isBrowser
      && !this.isPractice()
      && !this.disconnectForfeitSent
      && !!battleId
      && this.battleStatus() !== 'finished'
      && battleData?.status === 'accepted'
      && !battleData?.winner_id;
  }

  // Sirve para enviar una acción genérica de batalla enlazada y aplicar la respuesta del servidor.
  private submitLinkedBattleAction(payload: Record<string, unknown>): void {
    const battleId = this.battleId();
    if (!battleId) {
      this.battleStatus.set('ready');
      this.isSubmittingRun.set(false);
      return;
    }

    this.subs.add(
      this.battleService.submitAction(battleId, payload).subscribe({
        next: (data: any) => {
          this.isSubmittingRun.set(false);
          this.selectedBattleItem.set(null);
          this.currentSubMenu.set(null);
          const wasFinished = this.battleStatus() === 'finished';
          this.applyBattleSnapshot(data);
          this.inventoryService.loadInventory();

          if (data.winner_id && !wasFinished) {
            this.handleExternallyFinishedBattle(data);
            return;
          }
        },
        error: (error) => {
          this.isSubmittingRun.set(false);
          const message = error?.error?.message ?? 'Battle action failed.';
          this.currentSubMenu.set(null);
          this.selectedBattleItem.set(null);
          this.addLog(`Error: ${message}`, 'system');

          if (!this.isPractice() && /battle is not active/i.test(message)) {
            this.battleStatus.set('selecting');
            this.loadBattleData();
            return;
          }

          this.battleStatus.set('ready');
        },
      }),
    );
  }
}
