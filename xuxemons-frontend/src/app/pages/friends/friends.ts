import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth';
import { BattleService } from '../../core/services/battle.service';
import { FriendsService } from '../../core/services/friends.service';
import { ConfirmRemoveFriendModal } from '../../core/components/modals/confirm-remove-friend-modal/confirm-remove-friend-modal';
import { FriendCard } from '../../core/components/friend-card/friend-card';
import { FriendRequestCard } from '../../core/components/friend-request-card/friend-request-card';
import type { FriendUser, FriendRequestItem, SearchUser } from '../../core/interfaces';

@Component({
  selector: 'app-friends',
  imports: [FriendCard, FriendRequestCard, ReactiveFormsModule, ConfirmRemoveFriendModal],
  templateUrl: './friends.html',
  styleUrl: './friends.css',
})
export class Friends implements OnInit, OnDestroy {
  private readonly cardAnimationMs = 260;
  private readonly battlePollMs = 2500;
  private auth = inject(AuthService);
  private friendsService = inject(FriendsService);
  private battleService = inject(BattleService);
  private router = inject(Router);
  private subs = new Subscription();
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];
  private battlePollingInterval: ReturnType<typeof setInterval> | null = null;
  private friendsInitialized = false;
  private pendingRequestsInitialized = false;

  searchControl = new FormControl('');

  friends = signal<FriendUser[]>([]);
  pendingRequests = signal<FriendRequestItem[]>([]);
  searchResults = signal<SearchUser[]>([]);
  searchLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  confirmRemoveFriend = signal<FriendUser | null>(null);
  sendingRequestTo = signal<string[]>([]);
  searchIconErrors = signal<string[]>([]);
  enteringFriendIds = signal<string[]>([]);
  exitingFriendIds = signal<string[]>([]);
  enteringRequestIds = signal<number[]>([]);
  exitingRequestIds = signal<number[]>([]);
  busyRequestIds = signal<number[]>([]);
  busyFriendIds = signal<string[]>([]);
  challengeBusyFriendId = signal<string | null>(null);
  outgoingBattleId = signal<number | null>(null);
  outgoingBattleFriendId = signal<string | null>(null);
  isNavigatingToBattle = signal(false);

  private previousFocusedElement: HTMLElement | null = null;

  get pendingCount(): number {
    return this.pendingRequests().length;
  }

  get animationsEnabled(): boolean {
    return this.auth.getUser()?.view_animations ?? true;
  }

  get showSearchResults(): boolean {
    const q = this.searchControl.value ?? '';
    return q.length >= 3;
  }

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.subs.add(
      this.friendsService.friends.subscribe(f => {
        const previousIds = this.friends().map(friend => friend.id);
        this.friends.set(f);
        this.animateFriendEntries(previousIds, f);

        // If a user became a friend, mark as friend and clear request flags
        if (this.searchResults().length > 0) {
          const friendIds = f.map(ff => ff.id);
          this.searchResults.set(
            this.searchResults().map(u => friendIds.includes(u.id)
              ? { ...u, is_friend: true, request_received: false, request_sent: false }
              : { ...u, is_friend: false },
            ),
          );
        }
      }),
    );
    this.subs.add(
      this.friendsService.pendingRequests.subscribe(r => {
        const previousIds = this.pendingRequests().map(request => request.id);
        this.pendingRequests.set(r);
        this.animateRequestEntries(previousIds, r);

        // Update any displayed search results to reflect pending requests
        if (this.searchResults().length > 0) {
          const pendingSenderIds = r.map(pr => pr.sender_id);
          this.searchResults.set(
            this.searchResults().map(u => ({
              ...u,
              request_received: pendingSenderIds.includes(u.id),
            })),
          );
        }
      }),
    );

    // Clear results when query is too short
    this.subs.add(
      this.searchControl.valueChanges.pipe(
        filter(q => !q || q.length < 3),
      ).subscribe(() => {
        this.searchResults.set([]);
        this.searchLoading.set(false);
      }),
    );

    // Search with debounce when ≥3 chars
    this.subs.add(
      this.searchControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((q): q is string => !!q && q.length >= 3),
      ).subscribe(q => {
        this.searchLoading.set(true);
        this.friendsService.searchUsers(q).subscribe({
          next: results => {
            this.searchResults.set(results);
            this.searchLoading.set(false);
          },
          error: () => this.searchLoading.set(false),
        });
      }),
    );

    this.friendsService.loadAll();
    this.startBattlePolling();
  }

  // Sirve para destruir el componente
  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    this.stopBattlePolling();
  }

  // Sirve para iniciar polling de invitaciones y estado de batalla saliente
  private startBattlePolling(): void {
    this.pollBattleState();
    this.battlePollingInterval = setInterval(() => this.pollBattleState(), this.battlePollMs);
  }

  // Sirve para detener polling de batalla
  private stopBattlePolling(): void {
    if (this.battlePollingInterval) {
      clearInterval(this.battlePollingInterval);
      this.battlePollingInterval = null;
    }
  }

  // Sirve para comprobar invitaciones entrantes y reto saliente
  private pollBattleState(): void {
    this.pollOutgoingBattleStatus();
  }

  // Sirve para comprobar si el reto enviado ya fue aceptado/rechazado
  private pollOutgoingBattleStatus(): void {
    const battleId = this.outgoingBattleId();
    if (!battleId || this.isNavigatingToBattle()) {
      return;
    }

    this.subs.add(this.battleService.getBattle(battleId).subscribe({
      next: (battle: any) => {
        const status = String(battle?.status ?? '').toLowerCase();

        if (status === 'accepted') {
          this.navigateToBattle(battleId);
          return;
        }

        if (status === 'rejected' || status === 'completed' || status === 'finished') {
          this.outgoingBattleId.set(null);
          this.outgoingBattleFriendId.set(null);
          this.successMessage.set(status === 'rejected'
            ? 'Your challenge was rejected.'
            : 'The challenge is no longer active.');
          return;
        }

        if (status !== 'pending') {
          this.outgoingBattleId.set(null);
          this.outgoingBattleFriendId.set(null);
        }
      },
      error: () => {
        this.outgoingBattleId.set(null);
        this.outgoingBattleFriendId.set(null);
      },
    }));
  }

  // Sirve para navegar al combate evitando dobles navegaciones
  private navigateToBattle(battleId: number): void {
    if (this.isNavigatingToBattle()) {
      return;
    }

    this.isNavigatingToBattle.set(true);
    this.stopBattlePolling();
    this.router.navigate(['/battle', battleId]);
  }

  // Sirve para programar un timeout
  private scheduleTimeout(callback: () => void, delay: number): void {
    const timeoutId = setTimeout(() => {
      this.timeoutIds = this.timeoutIds.filter(id => id !== timeoutId);
      callback();
    }, delay);
    this.timeoutIds.push(timeoutId);
  }

  // Sirve para agregar IDs de amigos
  private addFriendIds(target: ReturnType<typeof signal<string[]>>, ids: string[]): void {
    if (ids.length === 0) return;
    const merged = [...target()];
    ids.forEach(id => {
      if (!merged.includes(id)) merged.push(id);
    });
    target.set(merged);
  }

  // Sirve para remover IDs de amigos
  private removeFriendIds(target: ReturnType<typeof signal<string[]>>, ids: string[]): void {
    if (ids.length === 0) return;
    target.set(target().filter(id => !ids.includes(id)));
  }

  // Sirve para agregar IDs de solicitudes de amistad
  private addRequestIds(target: ReturnType<typeof signal<number[]>>, ids: number[]): void {
    if (ids.length === 0) return;
    const merged = [...target()];
    ids.forEach(id => {
      if (!merged.includes(id)) merged.push(id);
    });
    target.set(merged);
  }

  // Sirve para remover IDs de solicitudes de amistad
  private removeRequestIds(target: ReturnType<typeof signal<number[]>>, ids: number[]): void {
    if (ids.length === 0) return;
    target.set(target().filter(id => !ids.includes(id)));
  }

  // Sirve para animar las entradas de amigos
  private animateFriendEntries(previousIds: string[], nextFriends: FriendUser[]): void {
    const shouldAnimateEntries = this.friendsInitialized && this.animationsEnabled;
    this.friendsInitialized = true;
    if (!shouldAnimateEntries) return;

    const enteringIds = nextFriends
      .map(friend => friend.id)
      .filter(id => !previousIds.includes(id));

    this.addFriendIds(this.enteringFriendIds, enteringIds);
    this.scheduleTimeout(() => this.removeFriendIds(this.enteringFriendIds, enteringIds), this.cardAnimationMs);
  }

  // Sirve para animar las entradas de solicitudes de amistad
  private animateRequestEntries(previousIds: number[], nextRequests: FriendRequestItem[]): void {
    const shouldAnimateEntries = this.pendingRequestsInitialized && this.animationsEnabled;
    this.pendingRequestsInitialized = true;
    if (!shouldAnimateEntries) return;

    const enteringIds = nextRequests
      .map(request => request.id)
      .filter(id => !previousIds.includes(id));

    this.addRequestIds(this.enteringRequestIds, enteringIds);
    this.scheduleTimeout(() => this.removeRequestIds(this.enteringRequestIds, enteringIds), this.cardAnimationMs);
  }

  // Sirve para remover una solicitud de amistad visible
  private removeVisibleRequest(requestId: number): void {
    this.pendingRequests.set(this.pendingRequests().filter(request => request.id !== requestId));
  }

  // Sirve para remover un amigo visible
  private removeVisibleFriend(friendId: string): void {
    this.friends.set(this.friends().filter(friend => friend.id !== friendId));
  }

  // Sirve para animar la eliminación de una solicitud de amistad
  private animateRequestRemoval(requestId: number, callback: () => void): void {
    this.addRequestIds(this.busyRequestIds, [requestId]);
    if (!this.animationsEnabled) {
      this.removeVisibleRequest(requestId);
      callback();
      return;
    }

    this.addRequestIds(this.exitingRequestIds, [requestId]);
    this.scheduleTimeout(() => {
      this.removeRequestIds(this.exitingRequestIds, [requestId]);
      this.removeVisibleRequest(requestId);
      callback();
    }, this.cardAnimationMs);
  }

  // Sirve para animar la eliminación de un amigo
  private animateFriendRemoval(friendId: string, callback: () => void): void {
    this.addFriendIds(this.busyFriendIds, [friendId]);
    if (!this.animationsEnabled) {
      this.removeVisibleFriend(friendId);
      callback();
      return;
    }

    this.addFriendIds(this.exitingFriendIds, [friendId]);
    this.scheduleTimeout(() => {
      this.removeFriendIds(this.exitingFriendIds, [friendId]);
      this.removeVisibleFriend(friendId);
      callback();
    }, this.cardAnimationMs);
  }

  // Sirve para verificar si un amigo está entrando
  isFriendEntering(friendId: string): boolean {
    return this.enteringFriendIds().includes(friendId);
  }

  // Sirve para verificar si un amigo está saliendo
  isFriendExiting(friendId: string): boolean {
    return this.exitingFriendIds().includes(friendId);
  }

  // Sirve para verificar si una solicitud de amistad está entrando
  isRequestEntering(requestId: number): boolean {
    return this.enteringRequestIds().includes(requestId);
  }

  // Sirve para verificar si una solicitud de amistad está saliendo
  isRequestExiting(requestId: number): boolean {
    return this.exitingRequestIds().includes(requestId);
  }

  // Sirve para verificar si una solicitud de amistad está ocupada
  isRequestBusy(requestId: number): boolean {
    return this.busyRequestIds().includes(requestId);
  }

  // Sirve para verificar si un amigo está ocupado
  isFriendBusy(friendId: string): boolean {
    return this.busyFriendIds().includes(friendId);
  }

  // Sirve para recargar todos los datos
  private reloadAll(): void {
    this.friendsService.loadFriends();
    this.friendsService.loadPendingRequests();
    const q = this.searchControl.value ?? '';
    if (q.length >= 3) {
      this.friendsService.searchUsers(q).subscribe({
        next: results => this.searchResults.set(results),
      });
    }
  }

  // Sirve para enviar una solicitud de amistad
  sendRequest(user: SearchUser): void {
    const current = [...this.sendingRequestTo()];
    if (!current.includes(user.id)) current.push(user.id);
    this.sendingRequestTo.set(current);

    this.errorMessage.set(null);
    this.friendsService.sendRequest(user.id).subscribe({
      next: res => {
        this.searchResults.set(
          this.searchResults().map(u =>
            u.id === user.id ? { ...u, request_sent: true } : u,
          ),
        );
        const cur = this.sendingRequestTo().filter(id => id !== user.id);
        this.sendingRequestTo.set(cur);

        if (res?.auto_accepted) {
          this.friendsService.loadFriends();
        }
      },
      error: () => {
        const cur = this.sendingRequestTo().filter(id => id !== user.id);
        this.sendingRequestTo.set(cur);
        this.reloadAll();
      },
    });
  }

  // Sirve para lanzar un challenge a un amigo
  challengeFriend(friend: FriendUser): void {
    if (this.challengeBusyFriendId() || this.isNavigatingToBattle()) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.challengeBusyFriendId.set(friend.id);

    this.subs.add(this.battleService.requestBattle(friend.id).subscribe({
      next: (battle: any) => {
        const battleId = Number(battle?.id);
        if (Number.isFinite(battleId) && battleId > 0) {
          this.outgoingBattleId.set(battleId);
          this.outgoingBattleFriendId.set(friend.id);
          this.successMessage.set(`Challenge sent to ${friend.name}. Waiting for acceptance...`);
        } else {
          this.successMessage.set(`Challenge sent to ${friend.name}.`);
        }
        this.challengeBusyFriendId.set(null);
      },
      error: (error) => {
        const existingBattleId = Number(error?.error?.battle_id);
        const existingBattleStatus = String(error?.error?.status ?? '').toLowerCase();
        if (Number.isFinite(existingBattleId) && existingBattleId > 0) {
          this.challengeBusyFriendId.set(null);
          if (existingBattleStatus === 'accepted') {
            this.successMessage.set('You already have an active battle with this friend. Rejoining...');
            this.navigateToBattle(existingBattleId);
            return;
          }

          if (existingBattleStatus === 'pending') {
            this.outgoingBattleId.set(existingBattleId);
            this.outgoingBattleFriendId.set(friend.id);
            this.successMessage.set(`You already have a pending challenge with ${friend.name}. Waiting for acceptance...`);
            return;
          }

          this.successMessage.set('You already have a battle with this friend.');
          return;
        }

        const backendMessage = String(error?.error?.message ?? '').trim();
        this.errorMessage.set(backendMessage || `Could not send challenge to ${friend.name}.`);
        this.challengeBusyFriendId.set(null);
      },
    }));
  }

  // Sirve para saber si el challenge está ocupado para un amigo
  isChallengeBusy(friendId: string): boolean {
    if (this.challengeBusyFriendId() === friendId) {
      return true;
    }

    if (this.outgoingBattleId() && this.outgoingBattleFriendId() === friendId) {
      return true;
    }

    return false;
  }

  // Sirve para cancelar una solicitud de amistad enviada
  cancelSentRequest(user: SearchUser): void {
    this.errorMessage.set(null);
    this.friendsService.cancelRequest(user.id).subscribe({
      next: () => {
        this.searchResults.set(
          this.searchResults().map(u => u.id === user.id ? { ...u, request_sent: false } : u),
        );
        this.successMessage.set('Friend request cancelled.');
      },
      error: () => this.reloadAll(),
    });
  }

  // Sirve para aceptar una solicitud de amistad
  acceptRequest(request: FriendRequestItem): void {
    if (this.isRequestBusy(request.id)) return;
    this.errorMessage.set(null);
    this.animateRequestRemoval(request.id, () => {
      this.friendsService.acceptRequest(request.id).subscribe({
        next: () => {
          this.removeRequestIds(this.busyRequestIds, [request.id]);
        },
        error: () => {
          this.removeRequestIds(this.busyRequestIds, [request.id]);
          this.reloadAll();
        },
      });
    });
  }

  // Sirve para rechazar una solicitud de amistad
  rejectRequest(request: FriendRequestItem): void {
    if (this.isRequestBusy(request.id)) return;
    this.errorMessage.set(null);
    this.animateRequestRemoval(request.id, () => {
      this.friendsService.rejectRequest(request.id).subscribe({
        next: () => this.removeRequestIds(this.busyRequestIds, [request.id]),
        error: () => {
          this.removeRequestIds(this.busyRequestIds, [request.id]);
          this.reloadAll();
        },
      });
    });
  }

  // Sirve para preguntar si se desea remover un amigo
  askConfirmRemove(friend: FriendUser): void {
    this.previousFocusedElement = typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null;
    this.confirmRemoveFriend.set(friend);
  }

  // Sirve para confirmar la eliminación de un amigo
  confirmRemove(): void {
    const friend = this.confirmRemoveFriend();
    if (!friend) return;
    this.confirmRemoveFriend.set(null);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }

    this.errorMessage.set(null);
    this.animateFriendRemoval(friend.id, () => {
      this.friendsService.removeFriend(friend.id).subscribe({
        next: () => {
          this.removeFriendIds(this.busyFriendIds, [friend.id]);
        },
        error: () => {
          this.removeFriendIds(this.busyFriendIds, [friend.id]);
          this.reloadAll();
        },
      });
    });
  }

  // Sirve para cancelar la eliminación de un amigo
  cancelRemove(): void {
    this.confirmRemoveFriend.set(null);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  // Sirve para verificar si se está enviando una solicitud de amistad a un usuario
  isSendingTo(userId: string): boolean {
    return this.sendingRequestTo().includes(userId);
  }

  // Sirve para obtener un amigo por su ID
  getFriendById(userId: string): FriendUser | undefined {
    return this.friends().find(f => f.id === userId);
  }

  // Sirve para obtener la URL del icono de un usuario
  getIconUrl(iconPath: string | null | undefined): string {
    if (!iconPath) return '';
    return this.auth.getAssetUrl(iconPath);
  }

  // Sirve para manejar el error de un icono de búsqueda
  onSearchIconError(userId: string): void {
    const cur = [...this.searchIconErrors()];
    if (!cur.includes(userId)) cur.push(userId);
    this.searchIconErrors.set(cur);
  }

  // Sirve para verificar si hay un error de icono de búsqueda
  hasSearchIconError(userId: string): boolean {
    return this.searchIconErrors().includes(userId);
  }

  // Sirve para cerrar la modal de eliminación de amigo al presionar Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmRemoveFriend()) this.cancelRemove();
  }

}
