import { take } from 'rxjs/operators';
import { Component, OnDestroy, OnInit, AfterViewInit, ViewChild, ElementRef, inject, signal, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BattleService } from '../../core/services/battle.service';
import { XuxemonService } from '../../core/services/xuxemon.service';
import { TeamService } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth';
import { InventoryService } from '../../core/services/inventory.service';
import type { InventoryItem, UseItemResponseData, Xuxemon } from '../../core/interfaces';

type BattleMenu = 'attacks' | 'bag' | 'bag-target' | 'switch' | null;

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './battle.html',
  styleUrl: './battle.css',
})
export class Battle implements OnInit, OnDestroy, AfterViewInit {
  private readonly bagPageSize = 4;
  private readonly diceTickMs = 80;
  private readonly diceTicks = 12;
  private readonly diceSettleMs = 560;
  private readonly attackWindupMs = 180;
  private readonly attackImpactMs = 380;
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
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private subs = new Subscription();
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private battleEventSource: EventSource | null = null;
  private streamBootstrapTimeout: ReturnType<typeof setTimeout> | null = null;
  private attackTrailTimeout: ReturnType<typeof setTimeout> | null = null;
  private battleCalloutTimeout: ReturnType<typeof setTimeout> | null = null;
  private teamIds: number[] = [];
  private lastBattleAnimationKey = '';
  private readonly handleVisibilityChange = () => {
    if (this.battleEventSource || !this.isBrowser) {
      return;
    }

    this.restartPolling();
  };

  @ViewChild('battleMusic') battleMusic?: ElementRef<HTMLAudioElement>;
  @ViewChild('diceSfx') diceSfx?: ElementRef<HTMLAudioElement>;
  @ViewChild('attackSfx') attackSfx?: ElementRef<HTMLAudioElement>;
  @ViewChild('impactSfx') impactSfx?: ElementRef<HTMLAudioElement>;

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
  showDice = signal(false);
  diceRolling = signal(false);
  diceLanded = signal(false);
  diceLabel = signal('Rolling for attack power!');
  showConfetti = signal(false);
  showVictoryModal = signal(false);
  showStealModal = signal(false);
  showRunConfirmModal = signal(false);
  showRunawayResultModal = signal(false);
  realtimeStatus = signal<'live' | 'syncing'>('syncing');
  attackImpactSide = signal<'player' | 'opponent' | null>(null);
  attackTrailSide = signal<'player' | 'opponent' | null>(null);
  battleCallout = signal<{ text: string; tone: 'buff' | 'nerf' | 'neutral' } | null>(null);
  isSubmittingBattleResult = signal(false);
  isSubmittingRun = signal(false);
  runawayResultMessage = signal('');

  battleLog = signal<string[]>([]);
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

  playerAttacking = signal(false);
  opponentAttacking = signal(false);
  playerHit = signal(false);
  opponentHit = signal(false);

  ngAfterViewInit(): void {
    this.startBattleMusic();
  }

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
    }

    this.loadTeamAndXuxemons();
    this.inventoryService.loadInventory();
    this.loadMyItems();
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    if (this.attackTrailTimeout) {
      clearTimeout(this.attackTrailTimeout);
      this.attackTrailTimeout = null;
    }

    if (this.battleCalloutTimeout) {
      clearTimeout(this.battleCalloutTimeout);
      this.battleCalloutTimeout = null;
    }

    this.stopBattleSync();
    this.stopBattleMusic();
    this.subs.unsubscribe();
  }

  startBattleSync(): void {
    this.loadBattleData();

    if (this.openBattleStream()) {
      return;
    }

    this.startPolling();
  }

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
      }),
    );
  }

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
      this.addLog(`${item.name} cannot be used during battle.`);
      return;
    }

    const eligibleTargets = this.getEligibleItemTargetsForItem(item);
    if (eligibleTargets.length === 0) {
      this.addLog(`No valid targets for ${item.name}.`);
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
          this.addLog(data.message || `You cannot use ${item.name} right now.`);
          this.battleStatus.set('ready');
          return;
        }

        this.addLog(`You used ${item.name} on ${target.name}!`);

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
        this.addLog(`Error: ${message}`);
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
    this.addLog(`Come back ${this.selectedXuxemon()?.name ?? 'Xuxemon'}! Go ${xuxemon.name}!`);

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

    this.rollDice(() => {
      this.executePlayerAttack(attackObj);
    }, undefined, `${this.selectedXuxemon()?.name ?? 'Your Xuxemon'} rolls the battle dice`);
  }

  rollDice(callback: () => void, finalValue?: number, label?: string): void {
    const resolvedRoll = typeof finalValue === 'number'
      ? Math.max(1, Math.min(6, Math.round(finalValue)))
      : Math.floor(Math.random() * 6) + 1;

    this.showDice.set(true);
    this.diceRolling.set(true);
    this.diceLanded.set(false);
    this.diceLabel.set(label ?? 'Rolling for attack power!');
    this.diceValue.set(null);
    this.playSfx(this.diceSfx, { volume: 0.3, fromMs: 80 });

    let counter = 0;
    const interval = setInterval(() => {
      this.diceValue.set(Math.floor(Math.random() * 6) + 1);
      counter++;
      if (counter > this.diceTicks) {
        clearInterval(interval);
        this.diceValue.set(resolvedRoll);
        this.diceRolling.set(false);
        this.diceLanded.set(true);
        this.playSfx(this.diceSfx, { volume: 0.42, fromMs: 440 });
        setTimeout(() => {
          this.showDice.set(false);
          this.diceLanded.set(false);
          callback();
        }, this.diceSettleMs);
      }
    }, this.diceTickMs);
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

    setTimeout(() => {
      this.triggerAttackTrail('player');
      this.playerAttacking.set(true);

      const attackerStat = attacker.attack || 10;
      const defenderStat = defender.defense || 5;
      const modifiers = this.calculateModifiers(attacker, defender);
      const roll = this.diceValue() || 0;
      const defenderMaxHp = defender.hp || 100;
      const defenderCurrentHp = this.getCurrentHpValue(defender);
      const damageAmount = this.calculateDamageAmount(attackerStat, defenderStat, attackObj.dmg, roll, modifiers, defenderMaxHp);
      const newHpValue = Math.max(0, defenderCurrentHp - damageAmount);
      const newHpPercent = defenderMaxHp > 0 ? (newHpValue / defenderMaxHp) * 100 : 0;
      const updatedDefender = this.applyAttackStatusEffectToTarget({ ...defender, current_hp: newHpValue }, attackObj);

      this.addLog(`${attacker.name} used ${attackObj.name}! (Roll: ${roll}, -${damageAmount} HP)`);

      setTimeout(() => {
        this.playerAttacking.set(false);
        this.showAttackImpact('opponent');
        this.opponentHP.set(newHpPercent);
        this.updateOpponentStateAfterItem(updatedDefender);

        setTimeout(() => {
          if (newHpValue <= 0) {
            this.handleOpponentFaint();
            return;
          }

          this.endTurn();
        }, 400);
      }, this.attackImpactMs);
    }, this.attackWindupMs);
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

    this.rollDice(
      () => this.executeOpponentAttack(randomAttack),
      undefined,
      `${opponent.name} rolls the battle dice`,
    );
  }

  private executeOpponentAttack(attackObj: any): void {
    const opponent = this.opponentXuxemon();
    const player = this.selectedXuxemon();
    if (!opponent || !player) {
      this.currentTurn.set('player');
      this.battleStatus.set('ready');
      return;
    }

    setTimeout(() => {
      this.triggerAttackTrail('opponent');
      this.opponentAttacking.set(true);

      const opponentAttack = opponent.attack || 10;
      const playerDefense = player.defense || 5;
      const roll = this.diceValue() || 0;
      const playerMaxHp = player.hp || 100;
      const playerCurrentHp = this.getCurrentHpValue(player);
      const damageAmount = this.calculateDamageAmount(
        opponentAttack,
        playerDefense,
        attackObj.dmg,
        roll,
        this.calculateModifiers(opponent, player),
        playerMaxHp,
      );
      const newHpValue = Math.max(0, playerCurrentHp - damageAmount);
      const newHpPercent = playerMaxHp > 0 ? (newHpValue / playerMaxHp) * 100 : 0;
      const updatedPlayer = this.applyAttackStatusEffectToTarget({ ...player, current_hp: newHpValue }, attackObj);

      this.addLog(`${opponent.name} used ${attackObj.name}! (Roll: ${roll}, -${damageAmount} HP)`);

      setTimeout(() => {
        this.opponentAttacking.set(false);
        this.showAttackImpact('player');
        this.playerHP.set(newHpPercent);
        this.updateMyTeamHp(updatedPlayer, newHpValue);

        if (updatedPlayer.adquired_id) {
          this.subs.add(this.xuxemonService.updateCurrentHp(updatedPlayer.adquired_id, newHpValue).subscribe());
        }

        setTimeout(() => {
          if (newHpValue <= 0) {
            this.handlePlayerFaint();
            return;
          }

          this.currentTurn.set('player');
          this.battleStatus.set('ready');
        }, 400);
      }, this.attackImpactMs);
    }, this.attackWindupMs);
  }

  calculateModifiers(attacker: Xuxemon, defender: Xuxemon): number {
    let modifiers = 0;
    const attackerType = attacker.type?.name?.toLowerCase() || '';
    const defenderType = defender.type?.name?.toLowerCase() || '';
    let effectiveness: 'buff' | 'nerf' | null = null;

    if ((attackerType === 'aigua' && defenderType === 'terra')
      || (attackerType === 'terra' && defenderType === 'aire')
      || (attackerType === 'aire' && defenderType === 'aigua')) {
      modifiers += 1;
      this.addLog(`It's super effective! +1`);
      effectiveness = 'buff';
      this.showBattleCallout('SUPER EFFECTIVE!', 'buff');
    }

    if ((attackerType === 'terra' && defenderType === 'aigua')
      || (attackerType === 'aire' && defenderType === 'terra')
      || (attackerType === 'aigua' && defenderType === 'aire')) {
      modifiers -= 1;
      this.addLog(`It's not very effective... -1`);
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
    const normalizedAttackPower = Math.max(6, Math.round((attackDamage ?? 36) / 10));
    const rawDamage = normalizedAttackPower
      + (attackerStat * 0.35)
      + roll
      + (modifiers * 2)
      - (defenderStat * 0.18);
    const damageAmount = Math.max(1, Math.round(rawDamage));
    const damageCap = Math.max(18, Math.round(defenderMaxHp * 0.18));

    return Math.min(damageAmount, damageCap);
  }

  addLog(message: string): void {
    this.battleLog.update((logs) => [message, ...logs].slice(0, 8));
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
          this.addLog(`${xuxemon.name} has joined your team.`);
          void this.xuxemonService.loadMyXuxemons();
        },
        error: () => {
          this.isSubmittingBattleResult.set(false);
          this.addLog('Could not complete the prize transfer.');
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
        },
        error: () => {
          this.isSubmittingBattleResult.set(false);
          this.addLog('Could not finish the battle.');
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
      this.addLog('VICTORY! You won the battle.');
      this.presentVictoryFlow();
      return;
    }

    this.addLog('DEFEAT...');

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

  runAway(): void {
    if (this.forcedSwitch()) {
      return;
    }

    this.showRunConfirmModal.set(true);
  }

  cancelRunAway(): void {
    this.showRunConfirmModal.set(false);
  }

  confirmRunAway(): void {
    if (this.isSubmittingRun()) {
      return;
    }

    this.showRunConfirmModal.set(false);

    if (this.isPractice()) {
      this.router.navigate(['/friends']);
      return;
    }

    this.isSubmittingRun.set(true);
    this.submitLinkedBattleAction({ action_type: 'run' });
  }

  closeRunawayResultModal(): void {
    this.showRunawayResultModal.set(false);
    this.stopBattleMusic();
    this.router.navigate(['/friends']);
  }

  getAssetUrl(path: string): string {
    return this.auth.getAssetUrl(path);
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

    if (myTeam.length > 0) {
      this.myXuxemons.set(myTeam);
    }
    if (opponentTeam.length > 0) {
      this.opponentTeam.set(opponentTeam);
    }

    if (Array.isArray(normalizedData.battle_log)) {
      this.battleLog.set(normalizedData.battle_log);
      this.triggerBattleAnimationsFromSnapshot(normalizedData);
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

  private triggerBattleAnimationsFromSnapshot(data: any): void {
    const attackLog = Array.isArray(data?.battle_log)
      ? data.battle_log.find((entry: string) => /^.+? used .+!/.test(entry)) ?? ''
      : '';
    const animationKey = `${data?.turn ?? ''}|${attackLog}`;

    if (!attackLog || attackLog === 'Battle started!' || this.lastBattleAnimationKey === animationKey) {
      return;
    }

    this.lastBattleAnimationKey = animationKey;

    const attackMatch = /^(.+?) used .+!/.exec(attackLog);
    if (!attackMatch) {
      return;
    }

    const attackerName = attackMatch[1]?.trim();
    const rollMatch = /Roll:\s*(\d+)/.exec(attackLog);
    const resolvedRoll = rollMatch ? Number(rollMatch[1]) : null;
    if (!attackerName) {
      return;
    }

    if (this.selectedXuxemon()?.name === attackerName) {
      this.playBattleAnimationSequence('player', attackerName, resolvedRoll);
      return;
    }

    if (this.opponentXuxemon()?.name === attackerName) {
      this.playBattleAnimationSequence('opponent', attackerName, resolvedRoll);
    }
  }

  private playBattleAnimationSequence(side: 'player' | 'opponent', attackerName: string, roll: number | null): void {
    if (typeof roll === 'number' && Number.isFinite(roll)) {
      this.rollDice(
        () => this.playSpriteAnimation(side),
        roll,
        `${attackerName} rolls the battle dice`,
      );
      return;
    }

    this.playSpriteAnimation(side);
  }

  private playSpriteAnimation(side: 'player' | 'opponent'): void {
    if (side === 'player') {
      this.triggerAttackTrail('player');
      this.playerAttacking.set(true);
      setTimeout(() => {
        this.playerAttacking.set(false);
        this.showAttackImpact('opponent');
      }, this.attackImpactMs);
      return;
    }

    this.triggerAttackTrail('opponent');
    this.opponentAttacking.set(true);
    setTimeout(() => {
      this.opponentAttacking.set(false);
      this.showAttackImpact('player');
    }, this.attackImpactMs);
  }

  private showAttackImpact(targetSide: 'player' | 'opponent'): void {
    this.attackImpactSide.set(targetSide);
    this.playSfx(this.impactSfx, { volume: 0.44, fromMs: 120 });

    if (targetSide === 'player') {
      this.playerHit.set(true);
      setTimeout(() => {
        this.playerHit.set(false);
        this.attackImpactSide.set(null);
      }, 360);
      return;
    }

    this.opponentHit.set(true);
    setTimeout(() => {
      this.opponentHit.set(false);
      this.attackImpactSide.set(null);
    }, 360);
  }

  private triggerAttackTrail(side: 'player' | 'opponent'): void {
    this.attackTrailSide.set(side);
    this.playSfx(this.attackSfx, { volume: 0.35, fromMs: side === 'player' ? 0 : 220 });

    if (this.attackTrailTimeout) {
      clearTimeout(this.attackTrailTimeout);
    }

    this.attackTrailTimeout = setTimeout(() => {
      this.attackTrailSide.set(null);
      this.attackTrailTimeout = null;
    }, 380);
  }

  private showBattleCallout(text: string, tone: 'buff' | 'nerf' | 'neutral'): void {
    this.battleCallout.set({ text, tone });

    if (this.battleCalloutTimeout) {
      clearTimeout(this.battleCalloutTimeout);
    }

    this.battleCalloutTimeout = setTimeout(() => {
      this.battleCallout.set(null);
      this.battleCalloutTimeout = null;
    }, 1300);
  }

  private playSfx(
    audioRef: ElementRef<HTMLAudioElement> | undefined,
    options?: { volume?: number; fromMs?: number },
  ): void {
    if (!this.isBrowser) {
      return;
    }

    const audio = audioRef?.nativeElement;
    if (!audio) {
      return;
    }

    try {
      audio.pause();
      audio.currentTime = Math.max(0, (options?.fromMs ?? 0) / 1000);
      audio.volume = options?.volume ?? 0.4;
      void audio.play().catch(() => undefined);
    } catch {
      // Ignore transient playback failures from browser autoplay policies.
    }
  }

  private startBattleMusic(): void {
    const audio = this.battleMusic?.nativeElement;
    if (!audio || !this.isBrowser || this.battleStatus() === 'finished') {
      return;
    }

    audio.loop = true;
    audio.volume = 0.4;

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
      receivedSnapshot = true;
      this.clearStreamBootstrapTimeout();
      this.stopPolling();
      this.realtimeStatus.set('live');
      this.handleRealtimeBattlePayload(message.data);
    });

    stream.onerror = () => {
      this.closeBattleStream();
      this.startPolling();
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
          this.addLog(`Battle starts! vs ${firstOpponent.name}`);
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

    this.addLog(`${currentOpponent.name} fainted!`);
    const nextOpponent = this.getFirstAlive(
      this.opponentTeam().filter((xuxemon) => !this.isSameXuxemon(xuxemon, currentOpponent)),
    );

    if (!nextOpponent) {
      this.finishBattle(true);
      return;
    }

    setTimeout(() => {
      this.opponentXuxemon.set(nextOpponent);
      this.syncOpponentBars(nextOpponent);
      this.addLog(`${this.opponentTrainerName()} sent out ${nextOpponent.name}!`);
      this.currentTurn.set('opponent');
      this.battleStatus.set('ready');
      setTimeout(() => this.opponentTurn(), 1200);
    }, 800);
  }

  private handlePlayerFaint(): void {
    const currentPlayer = this.selectedXuxemon();
    if (!currentPlayer) {
      return;
    }

    this.addLog(`${currentPlayer.name} fainted!`);
    const backups = this.getSwitchCandidates();

    if (backups.length === 0) {
      this.finishBattle(false);
      return;
    }

    this.forcedSwitch.set(true);
    this.currentTurn.set('player');
    this.currentSubMenu.set('switch');
    this.battleStatus.set('ready');
    this.addLog('Choose another Xuxemon to continue the battle.');
  }

  private handleExternallyFinishedBattle(data: any): void {
    const userId = this.auth.getUser()?.id;
    const playerWon = data.winner_id === userId;
    this.battleStatus.set('finished');
    this.stopBattleSync();

    if (data.completion_reason === 'runaway') {
      if (data.runner_id === userId) {
        this.runawayResultMessage.set('Has huido del combate.');
      } else {
        this.runawayResultMessage.set('Tu rival ha huido del combate.');
      }

      this.showRunawayResultModal.set(true);
      return;
    }

    if (playerWon) {
      this.addLog('The battle ended in your favor.');
      this.presentVictoryFlow();
      return;
    }

    this.addLog('The battle has already been completed.');
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
  ): Xuxemon {
    const statusChance = attackObj.status_chance ?? 0;

    if (!attackObj.statusEffect?.name || !statusChance || xuxemon.statusEffect?.name || this.getCurrentHpValue(xuxemon) <= 0) {
      return xuxemon;
    }

    if ((Math.random() * 100) > statusChance) {
      return xuxemon;
    }

    this.addLog(`${xuxemon.name} is now affected by ${attackObj.statusEffect.name}!`);

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

          this.addLog(`You used ${item.name} on ${target.name}!`);
          void this.xuxemonService.loadMyXuxemons();

          setTimeout(() => {
            this.selectedBattleItem.set(null);
            this.currentSubMenu.set(null);
            this.endTurn();
          }, 800);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Failed to use battle item.';
          this.addLog(`Error: ${message}`);
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
          this.addLog(`You used ${item.name} on ${target.name}!`);
          this.inventoryService.loadInventory();

          setTimeout(() => {
            this.selectedBattleItem.set(null);
            this.currentSubMenu.set(null);
            this.endTurn();
          }, 800);
        },
        error: (error) => {
          const message = error?.error?.message ?? 'Failed to use practice item.';
          this.addLog(`Error: ${message}`);
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
      this.addLog(`${xuxemon.name} is asleep and cannot move!`);
      this.clearStatusEffect(xuxemon, side);
      this.finishBlockedTurn(side);
      return { prevented: true };
    }

    if (statusName === 'Paralysis' && Math.random() < 0.35) {
      this.addLog(`${xuxemon.name} is paralyzed and cannot move!`);
      this.finishBlockedTurn(side);
      return { prevented: true };
    }

    if (statusName === 'Confusion' && Math.random() < 0.5) {
      const maxHp = xuxemon.hp || 100;
      const currentHp = this.getCurrentHpValue(xuxemon);
      const selfHitDamage = Math.max(1, Math.round(maxHp * 0.12));
      const newHpValue = Math.max(0, currentHp - selfHitDamage);

      this.addLog(`${xuxemon.name} is confused and hurt itself!`);
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
      this.playerHit.set(true);
      this.updateMyTeamHp(xuxemon, newHpValue);
      if (xuxemon.adquired_id) {
        this.subs.add(this.xuxemonService.updateCurrentHp(xuxemon.adquired_id, newHpValue).subscribe());
      }
      this.syncPlayerBars({ ...xuxemon, current_hp: newHpValue });

      setTimeout(() => {
        this.playerHit.set(false);
        if (newHpValue <= 0) {
          this.handlePlayerFaint();
          return;
        }

        this.finishBlockedTurn('player');
      }, 450);
      return;
    }

    this.opponentHit.set(true);
    this.updateOpponentTeamHp(xuxemon, newHpValue);
    this.syncOpponentBars({ ...xuxemon, current_hp: newHpValue });

    setTimeout(() => {
      this.opponentHit.set(false);
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
          this.addLog(`Error: ${message}`);
          this.battleStatus.set('ready');
        },
      }),
    );
  }
}
