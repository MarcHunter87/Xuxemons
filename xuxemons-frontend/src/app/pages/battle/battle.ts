import { take } from 'rxjs/operators';
import { Component, OnDestroy, OnInit, AfterViewInit, ViewChild, ElementRef, inject, signal, PLATFORM_ID, ChangeDetectorRef, NgZone, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription } from 'rxjs';
import { BattleService } from '../../core/services/battle.service';
import { XuxemonService } from '../../core/services/xuxemon.service';
import { TeamService } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth';
import { InventoryService } from '../../core/services/inventory.service';
import { BattleTurnHeaderComponent } from './components/battle-turn-header.component';
import { BattleFooterComponent } from './components/battle-footer.component';
import { BattleSelectionOverlayComponent } from './components/battle-selection-overlay.component';
import { BattleModalsComponent } from './components/battle-modals.component';
import type { InventoryItem, UseItemResponseData, Xuxemon } from '../../core/interfaces';

type BattleMenu = 'attacks' | 'bag' | 'bag-target' | 'switch' | null;
type BattleLogSource = 'player' | 'opponent' | 'system';
interface BattleLogEntry { text: string; source: BattleLogSource; }

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [
    CommonModule,
    BattleTurnHeaderComponent,
    BattleFooterComponent,
    BattleSelectionOverlayComponent,
    BattleModalsComponent,
  ],
  templateUrl: './battle.html',
  styleUrl: './battle.css',
  encapsulation: ViewEncapsulation.None,
})
export class Battle implements OnInit, OnDestroy, AfterViewInit {
  readonly vm = this;

  private readonly bagPageSize = 4;
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
  private diceLandingTimeout: ReturnType<typeof setTimeout> | null = null;
  private diceOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerAttackTimeout: ReturnType<typeof setTimeout> | null = null;
  private opponentAttackTimeout: ReturnType<typeof setTimeout> | null = null;
  private attackTrailTimeout: ReturnType<typeof setTimeout> | null = null;
  private impactBurstTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerHitTimeout: ReturnType<typeof setTimeout> | null = null;
  private opponentHitTimeout: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('playerSprite') playerSprite?: ElementRef<HTMLDivElement>;
  @ViewChild('opponentSprite') opponentSprite?: ElementRef<HTMLDivElement>;
  private playerFaintTimeout: ReturnType<typeof setTimeout> | null = null;
  private opponentFaintTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerSpriteAnimation: Animation | null = null;
  private opponentSpriteAnimation: Animation | null = null;
  private teamIds: number[] = [];
  private disconnectForfeitSent = false;
  private lastBattleAnimationKey = '';
  private readonly handleVisibilityChange = () => {
    if (this.battleEventSource || !this.isBrowser) {
      return;
    }

    this.restartPolling();
  };
  private readonly handlePageExit = (event: PageTransitionEvent | BeforeUnloadEvent) => {
    if ('persisted' in event && event.persisted) {
      return;
    }

    this.autoForfeitOnExit();
  };

  @ViewChild('battleMusic') battleMusic?: ElementRef<HTMLAudioElement>;

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

    if (this.diceLandingTimeout) {
      clearTimeout(this.diceLandingTimeout);
      this.diceLandingTimeout = null;
    }
    if (this.diceOverlayTimeout) {
      clearTimeout(this.diceOverlayTimeout);
      this.diceOverlayTimeout = null;
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
        this.applyBattleSnapshot(data);
        this.startBattleMusic();

        if (data.winner_id && this.battleStatus() !== 'finished') {
          this.handleExternallyFinishedBattle(data);
        }
      }, () => {}),
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

  loadTeamAndXuxemons(): void {
    this.subs.add(
      this.xuxemonService.myXuxemonsList.subscribe((list: Xuxemon[]) => {
        // Sirve para limitar la lista al equipo elegido cuando existen slots configurados.
        const filtered = this.teamIds.length > 0
          ? list.filter((xuxemon) => xuxemon.adquired_id !== undefined && this.teamIds.includes(Number(xuxemon.adquired_id)))
          : list;

        this.myXuxemons.set(filtered);
        this.refreshSelectedFromTeam(filtered);
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

  showSubMenu(menu: BattleMenu): void {
    if (this.forcedSwitch() && menu !== 'switch') {
      return;
    }

    if (menu === 'bag') {
      this.bagPage.set(0);
    }

    this.currentSubMenu.set(menu);
  }

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

  chooseBagItem(item: InventoryItem): void {
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
    this.currentSubMenu.set('bag-target');
  }

  cancelBagTargeting(): void {
    this.selectedBattleItem.set(null);
    this.currentSubMenu.set('bag');
  }

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
      if (wasForced) {
        this.forcedSwitch.set(false);
      }
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

  endTurn(): void {
    if (!this.isPractice()) {
      this.battleStatus.set('ready');
      return;
    }

    this.currentTurn.set('opponent');
    this.battleStatus.set('ready');
    setTimeout(() => this.opponentTurn(), this.isPractice() ? 1200 : 1600);
  }

  attack(attackObj: any): void {
    if (this.battleStatus() !== 'ready' || this.currentTurn() !== 'player') {
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

  private resolveRoll(finalValue?: number): number {
    return typeof finalValue === 'number'
      ? Math.max(1, Math.min(6, Math.round(finalValue)))
      : Math.floor(Math.random() * 6) + 1;
  }

  executePlayerAttack(attackObj: any): void {
    const attacker = this.selectedXuxemon();
    const defender = this.opponentXuxemon();
    if (!attacker || !defender) {
      return;
    }

    this.battleStatus.set('animating');

    const statusResolution = this.resolveStatusBeforeAttack(attacker, 'player');
    if (statusResolution.prevented) {
      return;
    }

    const attackerStat = attacker.attack || 10;
    const defenderStat = defender.defense || 5;
    const modifiers = this.calculateModifiers(attacker, defender, 'player');
    const roll = this.diceValue() || 0;
    this.playDiceRollAnimation(roll);
    this.playAttackLunge('player');

    const defenderMaxHp = defender.hp || 100;
    const defenderCurrentHp = this.getCurrentHpValue(defender);
    const damageAmount = this.calculateDamageAmount(attackerStat, defenderStat, attackObj.dmg, roll, modifiers, defenderMaxHp);
    const newHpValue = Math.max(0, defenderCurrentHp - damageAmount);
    const newHpPercent = defenderMaxHp > 0 ? (newHpValue / defenderMaxHp) * 100 : 0;
    const updatedDefender = this.applyAttackStatusEffectToTarget({ ...defender, current_hp: newHpValue }, attackObj, 'player');

    this.addLog(`${attacker.name} used ${attackObj.name}! (Roll: ${roll}, -${damageAmount} HP)`, 'player');

    // Wait for attack animation to finish before applying damage (700ms animation)
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
    }, 750);
  }

  opponentTurn(): void {
    if (!this.isPractice()) {
      return;
    }

    if (this.battleStatus() === 'finished' || this.forcedSwitch()) {
      return;
    }

    const opponent = this.opponentXuxemon();
    const player = this.selectedXuxemon();
    if (!opponent || !player) {
      return;
    }

    this.battleStatus.set('animating');

    const statusResolution = this.resolveStatusBeforeAttack(opponent, 'opponent');
    if (statusResolution.prevented) {
      return;
    }

    const availableAttacks = opponent.attacks && opponent.attacks.length > 0
      ? opponent.attacks
      : [{ name: 'Tackle', dmg: 10, status_chance: null, statusEffect: undefined }];
    const randomAttack = availableAttacks[Math.floor(Math.random() * availableAttacks.length)];

    this.diceValue.set(this.resolveRoll());
    this.executeOpponentAttack(randomAttack);
  }

  private executeOpponentAttack(attackObj: any): void {
    const opponent = this.opponentXuxemon();
    const player = this.selectedXuxemon();
    if (!opponent || !player) {
      this.currentTurn.set('player');
      this.battleStatus.set('ready');
      return;
    }

    const opponentAttack = opponent.attack || 10;
    const playerDefense = player.defense || 5;
    const roll = this.diceValue() || 0;
    this.playDiceRollAnimation(roll);
    this.playAttackLunge('opponent');

    const playerMaxHp = player.hp || 100;
    const playerCurrentHp = this.getCurrentHpValue(player);
    const damageAmount = this.calculateDamageAmount(
      opponentAttack,
      playerDefense,
      attackObj.dmg,
      roll,
      this.calculateModifiers(opponent, player, 'opponent'),
      playerMaxHp,
    );
    const newHpValue = Math.max(0, playerCurrentHp - damageAmount);
    const newHpPercent = playerMaxHp > 0 ? (newHpValue / playerMaxHp) * 100 : 0;
    const updatedPlayer = this.applyAttackStatusEffectToTarget({ ...player, current_hp: newHpValue }, attackObj, 'opponent');

    this.addLog(`${opponent.name} used ${attackObj.name}! (Roll: ${roll}, -${damageAmount} HP)`, 'opponent');

    // Wait for attack animation to finish before applying damage (700ms animation)
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
    }, 750);
  }

  calculateModifiers(attacker: Xuxemon, defender: Xuxemon, side: BattleLogSource = 'system'): number {
    let modifiers = 0;
    const attackerType = attacker.type?.name?.toLowerCase() || '';
    const defenderType = defender.type?.name?.toLowerCase() || '';
    let effectiveness: 'buff' | 'nerf' | null = null;

    if ((attackerType === 'aigua' && defenderType === 'terra')
      || (attackerType === 'terra' && defenderType === 'aire')
      || (attackerType === 'aire' && defenderType === 'aigua')) {
      modifiers += 1;
      this.addLog(`It's super effective! +1`, side);
      effectiveness = 'buff';
      this.showBattleCallout('SUPER EFFECTIVE!', 'buff');
    }

    if ((attackerType === 'terra' && defenderType === 'aigua')
      || (attackerType === 'aire' && defenderType === 'terra')
      || (attackerType === 'aigua' && defenderType === 'aire')) {
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

  calculateDamageAmount(
    attackerStat: number,
    defenderStat: number,
    attackDamage: number | undefined,
    roll: number,
    modifiers: number,
    defenderMaxHp: number,
  ): number {
    // Base damage must come from the active myXuxemon attack stat.
    const baseAttackDamage = Math.max(0, attackerStat);
    const normalizedAttackPower = Math.max(6, Math.round(baseAttackDamage / 10));
    const rawDamage = normalizedAttackPower
      + (attackerStat * 0.35)
      + roll
      + (modifiers * 2)
      - (defenderStat * 0.18);
    const damageAmount = Math.max(1, Math.round(rawDamage));
    const damageCap = Math.max(18, Math.round(defenderMaxHp * 0.18));

    return Math.min(damageAmount, damageCap);
  }

  addLog(message: string, source: BattleLogSource = 'system'): void {
    this.battleLog.update((logs) => [{ text: message, source }, ...logs].slice(0, 8));
  }

  private hydrateBattleLogNames(logs: unknown[], activePlayer: Xuxemon | null, activeOpponent: Xuxemon | null): BattleLogEntry[] {
    const playerName = activePlayer?.name?.toLowerCase() ?? '';
    const opponentName = activeOpponent?.name?.toLowerCase() ?? '';

    return logs.map((entry) => {
      const text = String(entry ?? '').trim();
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

  closeVictoryModal(): void {
    this.showVictoryModal.set(false);
    this.stopBattleMusic();
    this.router.navigate([this.isPractice() ? '/profile' : '/friends']);
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.battleStatus() === 'finished') {
      return true;
    }
    this.navGuardSubject = new Subject<boolean>();
    this.showRunConfirmModal.set(true);
    return this.navGuardSubject.asObservable();
  }

  runAway(): void {
    if (this.forcedSwitch()) {
      return;
    }

    this.showRunConfirmModal.set(true);
  }

  cancelRunAway(): void {
    this.showRunConfirmModal.set(false);
    if (this.navGuardSubject) {
      this.navGuardSubject.next(false);
      this.navGuardSubject.complete();
      this.navGuardSubject = null;
    }
  }

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

  closeRunawayResultModal(): void {
    this.showRunawayResultModal.set(false);
    this.stopBattleMusic();
    this.router.navigate(['/friends']);
  }

  getAssetUrl(path: string): string {
    return this.auth.getAssetUrl(path);
  }

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

  getSwitchCandidates(): Xuxemon[] {
    const currentId = this.selectedXuxemon()?.adquired_id;
    return this.myXuxemons().filter((xuxemon) => this.getCurrentHpValue(xuxemon) > 0 && xuxemon.adquired_id !== currentId);
  }

  getSwitchMenuXuxemons(): Xuxemon[] {
    const seen = new Set<string>();

    return this.myXuxemons().filter((xuxemon) => {
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

  canSwitchToXuxemon(xuxemon: Xuxemon): boolean {
    return this.getCurrentHpValue(xuxemon) > 0 && !this.isPlayerActiveXuxemon(xuxemon);
  }

  isPlayerActiveXuxemon(xuxemon: Xuxemon): boolean {
    const active = this.selectedXuxemon();
    return !!active && this.isSameXuxemon(active, xuxemon);
  }

  isOpponentActiveXuxemon(xuxemon: Xuxemon): boolean {
    const active = this.opponentXuxemon();
    return !!active && this.isSameXuxemon(active, xuxemon);
  }

  getEligibleItemTargets(): Xuxemon[] {
    return this.getEligibleItemTargetsForItem(this.selectedBattleItem());
  }

  paginatedBagItems(): InventoryItem[] {
    const start = this.bagPage() * this.bagPageSize;
    return this.myItems().slice(start, start + this.bagPageSize);
  }

  bagPageCount(): number {
    return this.getBagTotalPages(this.myItems().length);
  }

  canGoToPreviousBagPage(): boolean {
    return this.bagPage() > 0;
  }

  canGoToNextBagPage(): boolean {
    return this.bagPage() < this.bagPageCount() - 1;
  }

  previousBagPage(): void {
    if (!this.canGoToPreviousBagPage()) {
      return;
    }

    this.bagPage.update((page) => Math.max(0, page - 1));
  }

  nextBagPage(): void {
    if (!this.canGoToNextBagPage()) {
      return;
    }

    this.bagPage.update((page) => Math.min(this.bagPageCount() - 1, page + 1));
  }

  private getEligibleItemTargetsForItem(item: InventoryItem | null): Xuxemon[] {
    const team = this.myXuxemons();
    if (!item) {
      return [];
    }

    if (item.effect_type === 'Apply Status Effects') {
      const opponent = this.opponentXuxemon();
      if (!opponent || this.getCurrentHpValue(opponent) <= 0 || opponent.statusEffect?.name) {
        return [];
      }

      return [opponent];
    }

    const available = team.filter((xuxemon) => xuxemon.adquired_id !== undefined);
    const alive = available.filter((xuxemon) => this.getCurrentHpValue(xuxemon) > 0);

    if (item.effect_type === 'Heal') {
      return alive.filter((xuxemon) => (xuxemon.current_hp ?? xuxemon.hp ?? 0) < (xuxemon.hp ?? 0));
    }

    if (item.effect_type === 'DMG Up' || item.effect_type === 'Defense Up') {
      return alive;
    }

    if (item.effect_type === 'Remove Status Effects') {
      return alive.filter((xuxemon) => this.canUseStatusItemOnTarget(item, xuxemon));
    }

    return alive;
  }

  private isBattleUsableItem(item: InventoryItem): boolean {
    return item.effect_type !== undefined && this.supportedBattleEffectTypes.has(item.effect_type);
  }

  private shouldDisplayInBattleBag(item: InventoryItem): boolean {
    if (item.effect_type === 'Gacha Ticket') {
      return false;
    }

    return !this.isBattleExcludedEvolutionItem(item);
  }

  private isBattleExcludedEvolutionItem(item: InventoryItem): boolean {
    return item.effect_type === 'Evolve';
  }

  private getBagTotalPages(itemCount: number): number {
    return Math.max(1, Math.ceil(itemCount / this.bagPageSize));
  }

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

    if (normalizedData.status === 'accepted') {
      const isMyTurn = (normalizedData.turn % 2 === 0 && normalizedData.user_id === user.id)
        || (normalizedData.turn % 2 !== 0 && normalizedData.opponent_user_id === user.id);
      this.currentTurn.set(isMyTurn ? 'player' : 'opponent');
    }

    if (normalizedData.user && normalizedData.opponent_user) {
      const isOwner = normalizedData.user_id === user.id;
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
      this.syncPlayerBars(activePlayer);
    }

    const activeOpponent = opponentTeam.find((xuxemon: Xuxemon) => xuxemon.adquired_id === normalizedData.opponent_active_xuxemon_id)
      ?? this.getFirstAlive(opponentTeam);
    if (activeOpponent) {
      this.opponentXuxemon.set(activeOpponent);
      this.syncOpponentBars(activeOpponent);
    }

    if (Array.isArray(normalizedData.battle_log)) {
      const hydratedLog = this.hydrateBattleLogNames(normalizedData.battle_log, activePlayer, activeOpponent);
      this.battleLog.set(hydratedLog);
      this.triggerBattleAnimationsFromSnapshot(
        { ...normalizedData, battle_log: hydratedLog },
        {
          currentPlayer: activePlayer ?? null,
          currentOpponent: activeOpponent ?? null,
          previousPlayer: previousActivePlayer,
          previousOpponent: previousActiveOpponent,
        },
      );
    }

    const requiresForcedSwitch = Boolean(
      activePlayer
      && this.getCurrentHpValue(activePlayer) <= 0
      && this.currentTurn() === 'player'
      && myTeam.some((xuxemon: Xuxemon) => this.getCurrentHpValue(xuxemon) > 0 && xuxemon.adquired_id !== activePlayer.adquired_id)
      && !normalizedData.winner_id,
    );

    this.forcedSwitch.set(requiresForcedSwitch);
    if (requiresForcedSwitch) {
      this.currentSubMenu.set('switch');
    }

    if (!normalizedData.winner_id) {
      this.battleStatus.set(activePlayer && activeOpponent ? 'ready' : 'selecting');
    }
  }

  private normalizeBattleXuxemon(raw: any): Xuxemon {
    const rawImage = typeof raw?.image_url === 'string' ? raw.image_url : '';
    const hasAbsoluteImage = rawImage.startsWith('http://') || rawImage.startsWith('https://');
    const assetPath = raw?.icon_path
      ? this.auth.getAssetUrl(raw.icon_path.startsWith('/') ? raw.icon_path : `/${raw.icon_path}`)
      : '';
    const rawAttacks = Array.isArray(raw?.attacks) && raw.attacks.length > 0
      ? raw.attacks
      : [raw?.attack1, raw?.attack2].filter(Boolean);

    return {
      ...raw,
      image_url: hasAbsoluteImage
        ? rawImage
        : (rawImage ? this.auth.getAssetUrl(rawImage.startsWith('/') ? rawImage : `/${rawImage}`) : assetPath),
      statusEffect: this.normalizeEffect(raw?.statusEffect ?? raw?.status_effect),
      side_effect_1: this.normalizeEffect(raw?.side_effect_1),
      side_effect_2: this.normalizeEffect(raw?.side_effect_2),
      side_effect_3: this.normalizeEffect(raw?.side_effect_3),
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

  private triggerBattleAnimationsFromSnapshot(
    data: any,
    combatants?: {
      currentPlayer: Xuxemon | null;
      currentOpponent: Xuxemon | null;
      previousPlayer: Xuxemon | null;
      previousOpponent: Xuxemon | null;
    },
  ): void {
    const playerCandidates = [combatants?.currentPlayer, combatants?.previousPlayer]
      .filter((xuxemon): xuxemon is Xuxemon => Boolean(xuxemon));
    const opponentCandidates = [combatants?.currentOpponent, combatants?.previousOpponent]
      .filter((xuxemon): xuxemon is Xuxemon => Boolean(xuxemon));
    const knownCombatants = new Map<string, { side: 'player' | 'opponent'; xuxemon: Xuxemon }>();

    for (const xuxemon of playerCandidates) {
      knownCombatants.set(xuxemon.name.trim(), { side: 'player', xuxemon });
    }

    for (const xuxemon of opponentCandidates) {
      knownCombatants.set(xuxemon.name.trim(), { side: 'opponent', xuxemon });
    }

    const attackLog = Array.isArray(data?.battle_log)
      ? data.battle_log.find((entry: string) => {
        const text = String(entry ?? '').trim();
        const match = /^(.+?) used (.+?)!\s*\(Roll:\s*\d+/i.exec(text);
        if (!match) {
          return false;
        }

        const attackerName = match[1]?.trim();
        return knownCombatants.size === 0 || knownCombatants.has(attackerName);
      }) ?? ''
      : '';

    if (!attackLog || attackLog === 'Battle started!') {
      return;
    }

    const attackMatch = /^(.+?) used (.+?)!/.exec(attackLog);
    if (!attackMatch) {
      return;
    }

    const attackerName = attackMatch[1]?.trim();
    const extractedAttackName = attackMatch[2]?.trim();
    const rollMatch = /Roll:\s*(\d+)/.exec(attackLog);
    const resolvedRoll = rollMatch ? Number(rollMatch[1]) : null;
    if (!attackerName) {
      return;
    }

    let attackerContext = knownCombatants.get(attackerName) ?? null;

    if (!attackerContext) {
      const previousPlayerHp = combatants?.previousPlayer ? this.getCurrentHpValue(combatants.previousPlayer) : null;
      const currentPlayerHp = combatants?.currentPlayer ? this.getCurrentHpValue(combatants.currentPlayer) : null;
      const previousOpponentHp = combatants?.previousOpponent ? this.getCurrentHpValue(combatants.previousOpponent) : null;
      const currentOpponentHp = combatants?.currentOpponent ? this.getCurrentHpValue(combatants.currentOpponent) : null;

      if (
        previousOpponentHp !== null
        && currentOpponentHp !== null
        && currentOpponentHp < previousOpponentHp
        && combatants?.currentPlayer
      ) {
        attackerContext = { side: 'player', xuxemon: combatants.currentPlayer };
      } else if (
        previousPlayerHp !== null
        && currentPlayerHp !== null
        && currentPlayerHp < previousPlayerHp
        && combatants?.currentOpponent
      ) {
        attackerContext = { side: 'opponent', xuxemon: combatants.currentOpponent };
      }
    }

    if (!attackerContext) {
      return;
    }

    const animationKey = `${data?.turn ?? ''}|${attackLog}`;
    if (this.lastBattleAnimationKey === animationKey) {
      return;
    }

    this.lastBattleAnimationKey = animationKey;
    this.playBattleAnimationSequence(
      attackerContext.side,
      attackerName,
      resolvedRoll,
      extractedAttackName,
      attackerContext.xuxemon,
    );
  }

  private playBattleAnimationSequence(
    side: 'player' | 'opponent',
    attackerName: string,
    roll: number | null,
    attackName?: string,
    attackerOverride?: Xuxemon | null,
  ): void {
    void attackerName;
    void attackName;
    void attackerOverride;

    if (roll !== null) {
      this.playDiceRollAnimation(roll);
    }

    this.playAttackLunge(side);

    if (side === 'player' && this.opponentHP() <= 0) {
      this.playFaintAnimation('opponent');
    }

    if (side === 'opponent' && this.playerHP() <= 0) {
      this.playFaintAnimation('player');
    }
  }

  private playDiceRollAnimation(finalRoll: number): void {
    if (this.diceLandingTimeout) {
      clearTimeout(this.diceLandingTimeout);
    }
    if (this.diceOverlayTimeout) {
      clearTimeout(this.diceOverlayTimeout);
    }

    this.zone.run(() => {
      this.isDiceOverlayVisible.set(true);
      this.isDiceRolling.set(true);

      this.diceLandingTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isDiceRolling.set(false);
          this.diceValue.set(finalRoll);
        });
        this.diceLandingTimeout = null;
      }, 600);

      this.diceOverlayTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isDiceOverlayVisible.set(false);
        });
        this.diceOverlayTimeout = null;
      }, 1200);
    });
  }

  private playAttackLunge(side: 'player' | 'opponent'): void {
    const startAnimation = () => {
      this.playAttackEffects(side);
      this.runSpriteAttackAnimation(side);

      if (side === 'player') {
        if (this.playerAttackTimeout) {
          clearTimeout(this.playerAttackTimeout);
        }
        this.isPlayerAttacking.set(true);
        this.playerAttackTimeout = setTimeout(() => {
          this.zone.run(() => {
            this.isPlayerAttacking.set(false);
          });
          this.playerAttackTimeout = null;
        }, 700);
        return;
      }

      if (this.opponentAttackTimeout) {
        clearTimeout(this.opponentAttackTimeout);
      }
      this.isOpponentAttacking.set(true);
      this.opponentAttackTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isOpponentAttacking.set(false);
        });
        this.opponentAttackTimeout = null;
      }, 700);
    };

    this.zone.run(() => {
      if (side === 'player') {
        if (this.playerAttackTimeout) {
          clearTimeout(this.playerAttackTimeout);
        }
        this.isPlayerAttacking.set(false);
      } else {
        if (this.opponentAttackTimeout) {
          clearTimeout(this.opponentAttackTimeout);
        }
        this.isOpponentAttacking.set(false);
      }

      this.flushBattleView();

      if (this.isBrowser) {
        requestAnimationFrame(() => {
          this.zone.run(startAnimation);
        });
        return;
      }

      startAnimation();
    });
  }

  private runSpriteAttackAnimation(side: 'player' | 'opponent'): void {
    if (!this.isBrowser) {
      return;
    }

    const element = side === 'player'
      ? this.playerSprite?.nativeElement
      : this.opponentSprite?.nativeElement;

    if (!element || typeof element.animate !== 'function') {
      return;
    }

    const currentAnimation = side === 'player' ? this.playerSpriteAnimation : this.opponentSpriteAnimation;
    currentAnimation?.cancel();

    const direction = side === 'player' ? 1 : -1;
    const keyframes: Keyframe[] = [
      {
        transform: 'translate3d(0, 0, 0) scale(1)',
        filter: 'brightness(1)',
        offset: 0,
      },
      {
        transform: `translate3d(${direction * 84}px, ${direction * -18}px, 0) scale(1.08)`,
        filter: 'brightness(1.12)',
        offset: 0.34,
      },
      {
        transform: `translate3d(${direction * 28}px, ${direction * -6}px, 0) scale(1.03)`,
        filter: 'brightness(1.05)',
        offset: 0.62,
      },
      {
        transform: 'translate3d(0, 0, 0) scale(1)',
        filter: 'brightness(1)',
        offset: 1,
      },
    ];

    const animation = element.animate(keyframes, {
      duration: 700,
      easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)',
      fill: 'none',
    });

    animation.onfinish = () => {
      if (side === 'player') {
        this.playerSpriteAnimation = null;
        return;
      }

      this.opponentSpriteAnimation = null;
    };

    if (side === 'player') {
      this.playerSpriteAnimation = animation;
      return;
    }

    this.opponentSpriteAnimation = animation;
  }

  private playAttackEffects(attackerSide: 'player' | 'opponent'): void {
    const targetSide = attackerSide === 'player' ? 'opponent' : 'player';

    if (this.attackTrailTimeout) {
      clearTimeout(this.attackTrailTimeout);
    }
    if (this.impactBurstTimeout) {
      clearTimeout(this.impactBurstTimeout);
    }
    if (this.playerHitTimeout) {
      clearTimeout(this.playerHitTimeout);
    }
    if (this.opponentHitTimeout) {
      clearTimeout(this.opponentHitTimeout);
    }

    this.activeAttackTrail.set(null);
    this.activeImpactBurst.set(null);
    this.isPlayerHit.set(false);
    this.isOpponentHit.set(false);
    this.flushBattleView();

    const activateEffects = () => {
      this.activeAttackTrail.set(attackerSide);
      this.activeImpactBurst.set(targetSide);

      if (targetSide === 'player') {
        this.isPlayerHit.set(true);
      } else {
        this.isOpponentHit.set(true);
      }

      this.attackTrailTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.activeAttackTrail.set(null);
        });
        this.attackTrailTimeout = null;
      }, 340);

      this.impactBurstTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.activeImpactBurst.set(null);
        });
        this.impactBurstTimeout = null;
      }, 420);

      const clearHit = () => {
        if (targetSide === 'player') {
          this.isPlayerHit.set(false);
          this.playerHitTimeout = null;
          return;
        }

        this.isOpponentHit.set(false);
        this.opponentHitTimeout = null;
      };

      if (targetSide === 'player') {
        this.playerHitTimeout = setTimeout(() => {
          this.zone.run(clearHit);
        }, 360);
        return;
      }

      this.opponentHitTimeout = setTimeout(() => {
        this.zone.run(clearHit);
      }, 360);
    };

    if (this.isBrowser) {
      requestAnimationFrame(() => {
        this.zone.run(activateEffects);
      });
      return;
    }

    activateEffects();
  }

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

  private flushBattleView(): void {
    this.cdr.detectChanges();
  }

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

  private handleRealtimeBattlePayload(rawPayload: string): void {
    try {
      const data = JSON.parse(rawPayload);
      this.applyBattleSnapshot(data);
      this.startBattleMusic();

      if (data.winner_id && this.battleStatus() !== 'finished') {
        this.handleExternallyFinishedBattle(data);
      }
    } catch (error) {
      console.warn('Could not parse battle stream payload', error);
    }
  }

  private stopBattleSync(): void {
    this.stopPolling();
    this.closeBattleStream();
  }

  private stopPolling(): void {
    if (!this.pollingInterval) {
      return;
    }

    clearInterval(this.pollingInterval);
    this.pollingInterval = null;
  }

  private restartPolling(): void {
    if (this.battleEventSource) {
      return;
    }

    this.stopPolling();
    this.startPolling();
  }

  private closeBattleStream(): void {
    this.clearStreamBootstrapTimeout();

    if (!this.battleEventSource) {
      return;
    }

    this.battleEventSource.close();
    this.battleEventSource = null;
  }

  private clearStreamBootstrapTimeout(): void {
    if (!this.streamBootstrapTimeout) {
      return;
    }

    clearTimeout(this.streamBootstrapTimeout);
    this.streamBootstrapTimeout = null;
  }

  private getPollingIntervalMs(): number {
    if (!this.isBrowser) {
      return 3000;
    }

    return document.visibilityState === 'visible' ? 3000 : 6500;
  }

  private stopBattleMusic(): void {
    const audio = this.battleMusic?.nativeElement;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }

  private refreshSelectedFromTeam(team: Xuxemon[]): void {
    // Sirve para mantener seleccionado el mismo Xuxemon tras refrescos del equipo.
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
      this.currentSubMenu.set('switch');
      this.battleStatus.set('ready');
      this.addLog('Choose another Xuxemon to continue the battle.', 'system');
    });
  }

  private handleExternallyFinishedBattle(data: any): void {
    const userId = this.auth.getUser()?.id;
    const playerWon = data.winner_id === userId;
    this.battleStatus.set('finished');
    this.stopBattleSync();

    if (data.completion_reason === 'runaway') {
      if (data.runner_id === userId) {
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

  private getCurrentHpValue(xuxemon: Xuxemon): number {
    return Math.max(0, xuxemon.current_hp ?? xuxemon.hp ?? 0);
  }

  private syncPlayerBars(xuxemon: Xuxemon): void {
    const maxHp = xuxemon.hp || 100;
    const currentHp = this.getCurrentHpValue(xuxemon);
    this.playerMaxHP.set(maxHp);
    this.playerHP.set(maxHp > 0 ? (currentHp / maxHp) * 100 : 0);
  }

  private syncOpponentBars(xuxemon: Xuxemon): void {
    const maxHp = xuxemon.hp || 100;
    const currentHp = this.getCurrentHpValue(xuxemon);
    this.opponentMaxHP.set(maxHp);
    this.opponentHP.set(maxHp > 0 ? (currentHp / maxHp) * 100 : 0);
  }

  private updateMyTeamHp(target: Xuxemon, currentHp: number): void {
    const updated = { ...target, current_hp: currentHp };
    this.selectedXuxemon.set(updated);
    this.replaceMyTeamMember(updated);
  }

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

  private replaceMyTeamMember(updated: Xuxemon): void {
    this.myXuxemons.update((team) => team.map((xuxemon) => xuxemon.adquired_id === updated.adquired_id ? updated : xuxemon));
  }

  private getFirstAlive(team: Xuxemon[]): Xuxemon | null {
    return team.find((xuxemon) => this.getCurrentHpValue(xuxemon) > 0) ?? null;
  }

  private isSameXuxemon(left: Xuxemon, right: Xuxemon): boolean {
    if (left.adquired_id !== undefined || right.adquired_id !== undefined) {
      return left.adquired_id === right.adquired_id;
    }

    return left.id === right.id;
  }

  private getStealOptions(): Xuxemon[] {
    const data = this.battleData();
    const options = (data?.opponent_available_xuxemons ?? this.opponentTeam()) as Xuxemon[];
    return options.filter((xuxemon) => xuxemon.adquired_id !== undefined);
  }

  private getOpponentUserId(): string | null {
    const data = this.battleData();
    const userId = this.auth.getUser()?.id;
    if (!data || !userId) {
      return null;
    }
    return data.user_id === userId ? data.opponent_user_id : data.user_id;
  }

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

    return {
      ...xuxemon,
      statusEffect: attackObj.statusEffect,
    };
  }

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

  private applyStatusEffectToXuxemon(xuxemon: Xuxemon, data?: UseItemResponseData): Xuxemon {
    const rawStatusEffect = data?.applied_status_effect;
    const statusEffect = rawStatusEffect?.name
      ? {
        name: rawStatusEffect.name,
        icon_url: rawStatusEffect.icon_url ?? this.auth.getAssetUrl(`/${rawStatusEffect.icon_path ?? ''}`),
      }
      : xuxemon.statusEffect;

    return {
      ...xuxemon,
      statusEffect,
    };
  }

  private updateOpponentStateAfterItem(updatedOpponent: Xuxemon): void {
    this.opponentXuxemon.set(updatedOpponent);
    this.opponentTeam.update((team) => team.map((xuxemon) => this.isSameXuxemon(xuxemon, updatedOpponent) ? updatedOpponent : xuxemon));
  }

  private resolveStatusBeforeAttack(xuxemon: Xuxemon, side: 'player' | 'opponent'): { prevented: boolean } {
    const statusName = xuxemon.statusEffect?.name;
    if (!statusName) {
      return { prevented: false };
    }

    if (statusName === 'Sleep') {
      this.addLog(`${xuxemon.name} is asleep and cannot move!`, side);
      this.clearStatusEffect(xuxemon, side);
      this.finishBlockedTurn(side);
      return { prevented: true };
    }

    if (statusName === 'Paralysis' && Math.random() < 0.35) {
      this.addLog(`${xuxemon.name} is paralyzed and cannot move!`, side);
      this.finishBlockedTurn(side);
      return { prevented: true };
    }

    if (statusName === 'Confusion' && Math.random() < 0.5) {
      const maxHp = xuxemon.hp || 100;
      const currentHp = this.getCurrentHpValue(xuxemon);
      const selfHitDamage = Math.max(1, Math.round(maxHp * 0.12));
      const newHpValue = Math.max(0, currentHp - selfHitDamage);

      this.addLog(`${xuxemon.name} is confused and hurt itself!`, side);
      this.applySelfDamageFromStatus(xuxemon, side, newHpValue);
      return { prevented: true };
    }

    return { prevented: false };
  }

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

  private clearStatusEffect(xuxemon: Xuxemon, side: 'player' | 'opponent'): void {
    const updated = { ...xuxemon, statusEffect: undefined };

    if (side === 'player') {
      this.selectedXuxemon.set(updated);
      this.replaceMyTeamMember(updated);
      return;
    }

    this.updateOpponentStateAfterItem(updated);
  }

  private clearNamedSideEffect(
    sideEffect: Xuxemon['side_effect_1'] | undefined,
    effectName: string,
  ): Xuxemon['side_effect_1'] | undefined {
    return sideEffect?.name === effectName ? undefined : sideEffect;
  }

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
          this.currentSubMenu.set(this.forcedSwitch() ? 'switch' : null);
          this.applyBattleSnapshot(data);
          this.inventoryService.loadInventory();

          if (data.winner_id && this.battleStatus() !== 'finished') {
            this.handleExternallyFinishedBattle(data);
            return;
          }

          this.battleStatus.set(this.forcedSwitch() ? 'ready' : 'ready');
        },
        error: (error) => {
          this.isSubmittingRun.set(false);
          const message = error?.error?.message ?? 'Battle action failed.';
          this.addLog(`Error: ${message}`, 'system');
          this.battleStatus.set('ready');
        },
      }),
    );
  }
}
