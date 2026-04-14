import { take } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BattleService } from '../../core/services/battle.service';
import { XuxemonService } from '../../core/services/xuxemon.service';
import { TeamService } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth';
import type { Xuxemon } from '../../core/interfaces';

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './battle.html',
  styleUrl: './battle.css',
})
export class Battle implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private battleService = inject(BattleService);
  private xuxemonService = inject(XuxemonService);
  private teamService = inject(TeamService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  battleId = signal<number | null>(null);
  isPractice = signal<boolean>(false);
  battleData = signal<any>(null);
  myXuxemons = signal<Xuxemon[]>([]);
  team = signal<any>(null);
  
  selectedXuxemon = signal<Xuxemon | null>(null);
  opponentXuxemon = signal<Xuxemon | null>(null);
  
  battleStatus = signal<'selecting' | 'ready' | 'animating' | 'finished'>('selecting');
  
  playerHP = signal(100);
  playerMaxHP = signal(100);
  opponentHP = signal(100);
  opponentMaxHP = signal(100);
  
  diceValue = signal<number | null>(null);
  showDice = signal(false);
  diceRolling = signal(false);
  showConfetti = signal(false);
  showVictoryModal = signal(false);
  
  currentTurn = signal<'player' | 'opponent'>('player');
  currentSubMenu = signal<'attacks' | 'bag' | 'switch' | null>(null);
  battleLog = signal<string[]>([]);
  myItems = signal<any[]>([]);
  
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

  private pollingInterval: any;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const user = this.auth.getUser();
    if (user) {
      this.playerTrainerName.set(user.name);
      this.playerTrainerLevel.set(user.level || 1);
      this.playerTrainerIcon.set(this.auth.getAssetUrl(user.icon_path || ''));
    }

    if (id) {
      this.battleId.set(+id);
      this.startPolling();
    } else {
      this.isPractice.set(true);
      this.opponentTrainerName.set('AI Trainer');
      this.opponentTrainerLevel.set(10);
      this.opponentTrainerIcon.set('assets/icons/ai-trainer.png');
    }
    this.loadTeamAndXuxemons();
    this.loadMyItems();
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  startPolling(): void {
    this.loadBattleData();
    this.pollingInterval = setInterval(() => {
      if (this.battleStatus() !== 'animating') {
        this.loadBattleData();
      }
    }, 3000);
  }

  loadBattleData(): void {
    if (this.battleId()) {
      this.battleService.getBattle(this.battleId()!).subscribe((data: any) => {
        this.battleData.set(data);
        
        const user = this.auth.getUser();
        if (user && data.status === 'accepted') {
          const isMyTurn = (data.turn % 2 === 0 && data.user_id === user.id) || 
                           (data.turn % 2 !== 0 && data.opponent_user_id === user.id);
          this.currentTurn.set(isMyTurn ? 'player' : 'opponent');
        }

        if (user && data.user && data.opponent_user) {
          const isOwner = data.user_id === user.id;
          const opp = isOwner ? data.opponent_user : data.user;
          this.opponentTrainerName.set(opp.name);
          this.opponentTrainerLevel.set(opp.level || 1);
          this.opponentTrainerIcon.set(this.auth.getAssetUrl(opp.icon_path || ''));
        }

        if (data.status === 'accepted' && !this.opponentXuxemon()) {
          this.pickOpponentXuxemon();
        }

        if (data.winner_id && this.battleStatus() !== 'finished') {
          this.finishBattle(data.winner_id === user?.id);
        }
      });
    }
  }

  pickOpponentXuxemon(): void {
    this.xuxemonService.loadAllXuxemons();
    this.xuxemonService.xuxemonsList.pipe(take(1)).subscribe((all: Xuxemon[]) => {
      if (all.length > 0 && !this.opponentXuxemon()) {
        const random = all[Math.floor(Math.random() * all.length)];
        this.opponentXuxemon.set(random);
        this.opponentMaxHP.set(random.hp || 100);
        this.opponentHP.set(100);
        
        if (this.selectedXuxemon()) {
          this.battleStatus.set('ready');
        }
        this.addLog(`Battle starts! vs ${random.name}`);
      }
    });
  }

  loadMyItems(): void {
    this.myItems.set([
      { id: 1, name: 'Potion', quantity: 3, heal: 20 },
      { id: 2, name: 'Super Potion', quantity: 1, heal: 50 }
    ]);
  }

  showSubMenu(menu: 'attacks' | 'bag' | 'switch' | null): void {
    this.currentSubMenu.set(menu);
  }

  useItem(item: any): void {
    if (this.currentTurn() !== 'player' || this.battleStatus() !== 'ready') return;
    
    this.battleStatus.set('animating');
    this.addLog(`You used ${item.name}!`);
    
    if (item.heal) {
      const healAmount = (item.heal / this.playerMaxHP()) * 100;
      this.playerHP.update(hp => Math.min(100, hp + healAmount));
    }
    
    item.quantity--;
    if (item.quantity <= 0) {
      this.myItems.update(items => items.filter(i => i.id !== item.id));
    }

    setTimeout(() => {
      this.showSubMenu(null);
      this.endTurn();
    }, 1000);
  }

  switchXuxemon(xuxemon: Xuxemon): void {
    if (this.currentTurn() !== 'player' || this.battleStatus() !== 'ready') return;
    
    this.battleStatus.set('animating');
    this.addLog(`Come back ${this.selectedXuxemon()?.name}! Go ${xuxemon.name}!`);
    
    setTimeout(() => {
      this.selectedXuxemon.set(xuxemon);
      this.playerMaxHP.set(xuxemon.hp || 100);
      this.playerHP.set(100); 
      
      this.showSubMenu(null);
      this.endTurn();
    }, 1000);
  }

  endTurn(): void {
    if (this.isPractice()) {
      this.currentTurn.set('opponent');
      this.battleStatus.set('ready');
      setTimeout(() => this.opponentTurn(), 1200);
    } else {
      this.currentTurn.set('opponent');
      this.battleStatus.set('ready');
      setTimeout(() => this.opponentTurn(), 2000);
    }
  }

  attack(attackObj: any): void {
    if (this.battleStatus() !== 'ready' || this.currentTurn() !== 'player') return;
    
    this.rollDice(() => {
      this.executePlayerAttack(attackObj);
    });
  }

  rollDice(callback: () => void): void {
    this.showDice.set(true);
    this.diceRolling.set(true);
    
    let counter = 0;
    const interval = setInterval(() => {
      this.diceValue.set(Math.floor(Math.random() * 6) + 1);
      counter++;
      if (counter > 12) {
        clearInterval(interval);
        this.diceRolling.set(false);
        setTimeout(() => {
          this.showDice.set(false);
          callback();
        }, 600);
      }
    }, 80);
  }

  executePlayerAttack(attackObj: any): void {
    this.battleStatus.set('animating');
    
    setTimeout(() => {
      this.playerAttacking.set(true);
      
      const modifiers = this.calculateModifiers(this.selectedXuxemon()!, this.opponentXuxemon()!);
      const roll = this.diceValue() || 0;
      const baseDmg = attackObj.dmg || 10;
      
      const damagePercent = Math.max(5, (baseDmg + roll + modifiers) * 0.8);
      
      this.addLog(`${this.selectedXuxemon()?.name} used ${attackObj.name}! (Roll: ${roll}, Mods: ${modifiers})`);

      setTimeout(() => {
        this.playerAttacking.set(false);
        this.opponentHit.set(true);
        
        const newHP = Math.max(0, this.opponentHP() - damagePercent);
        this.opponentHP.set(newHP);
        
        setTimeout(() => {
          this.opponentHit.set(false);
          
          if (newHP <= 0) {
            this.finishBattle(true);
          } else {
            this.endTurn();
          }
        }, 400);
      }, 400);
    }, 200);
  }

  opponentTurn(): void {
    if (this.battleStatus() === 'finished') return;
    
    this.battleStatus.set('animating');
    
    setTimeout(() => {
      this.opponentAttacking.set(true);
      
      const opp = this.opponentXuxemon();
      const availableAttacks = opp?.attacks && opp.attacks.length > 0 ? opp.attacks : [{name: 'Tackle', dmg: 10}];
      const randomAttack = availableAttacks[Math.floor(Math.random() * availableAttacks.length)];
      
      const damage = Math.max(5, (randomAttack.dmg || 10) * 0.7 + Math.floor(Math.random() * 5));
      this.addLog(`${opp?.name} used ${randomAttack.name}!`);

      setTimeout(() => {
        this.opponentAttacking.set(false);
        this.playerHit.set(true);
        
        const newHP = Math.max(0, this.playerHP() - damage);
        this.playerHP.set(newHP);
        
        setTimeout(() => {
          this.playerHit.set(false);
          
          if (newHP <= 0) {
            this.finishBattle(false);
          } else {
            this.currentTurn.set('player');
            this.battleStatus.set('ready');
          }
        }, 400);
      }, 400);
    }, 400);
  }

  calculateModifiers(attacker: Xuxemon, defender: Xuxemon): number {
    let mods = 0;
    const aType = attacker.type?.name?.toLowerCase() || '';
    const dType = defender.type?.name?.toLowerCase() || '';
    
    if ((aType === 'aigua' && dType === 'terra') || 
        (aType === 'terra' && dType === 'aire') || 
        (aType === 'aire' && dType === 'aigua')) {
      mods += 2;
      this.addLog("It's super effective! +2");
    }
    
    if ((aType === 'terra' && dType === 'aigua') || 
        (aType === 'aire' && dType === 'terra') || 
        (aType === 'aigua' && dType === 'aire')) {
      mods -= 2;
      this.addLog("It's not very effective... -2");
    }
    
    if (attacker.size === 'Large') {
      mods += 1;
    }
    
    return mods;
  }

  addLog(msg: string): void {
    this.battleLog.update(logs => [msg, ...logs].slice(0, 6));
  }

  finishBattle(playerWon: boolean): void {
    this.battleStatus.set('finished');
    
    if (playerWon) {
      this.showConfetti.set(true);
      this.showVictoryModal.set(true);
      this.addLog("VICTORY! You won the battle.");
      
      if (!this.isPractice()) {
        const winnerId = this.auth.getUser()?.id;
        const loserXuxemonId = this.opponentXuxemon()?.adquired_id || 1;
        this.battleService.finishBattle(this.battleId()!, winnerId!, loserXuxemonId).subscribe();
      }
    } else {
      this.addLog("DEFEAT...");
      setTimeout(() => {
        alert("Defeat! You lost the battle.");
        this.router.navigate(['/friends']);
      }, 1500);
    }
  }

  closeVictoryModal(): void {
    this.showVictoryModal.set(false);
    this.router.navigate([this.isPractice() ? '/profile' : '/friends']);
  }

  runAway(): void {
    if (confirm('Are you sure you want to run away?')) {
      this.router.navigate(['/friends']);
    }
  }

  loadTeamAndXuxemons(): void {
    this.teamService.getTeam().subscribe((t: any) => {
      this.team.set(t);
      this.xuxemonService.loadMyXuxemons();
      this.xuxemonService.myXuxemonsList.subscribe((list: Xuxemon[]) => {
        const teamIds = [
          t.slot_1_adquired_xuxemon_id,
          t.slot_2_adquired_xuxemon_id,
          t.slot_3_adquired_xuxemon_id,
          t.slot_4_adquired_xuxemon_id,
          t.slot_5_adquired_xuxemon_id,
          t.slot_6_adquired_xuxemon_id,
        ].filter(id => id !== null).map(id => Number(id));

        if (teamIds.length > 0) {
          this.myXuxemons.set(list.filter(x => x.adquired_id !== undefined && teamIds.includes(Number(x.adquired_id))));
        } else {
          this.myXuxemons.set(list);
        }
        this.cdr.detectChanges();
      });
    });
  }

  selectXuxemon(xuxemon: Xuxemon): void {
    this.selectedXuxemon.set(xuxemon);
    this.playerMaxHP.set(xuxemon.hp || 100);
    this.playerHP.set(100); 
    
    if (this.opponentXuxemon()) {
      this.battleStatus.set('ready');
    }

    if (this.isPractice()) {
      this.pickOpponentXuxemon();
    }
  }

  getAssetUrl(path: string): string {
    return this.auth.getAssetUrl(path);
  }
}
