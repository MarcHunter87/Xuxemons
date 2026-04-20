import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BattleService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = this.isBrowser ? 'http://localhost:8080/api/battles' : 'http://backend/api/battles';
  private readonly http = inject(HttpClient);

  requestBattle(friendId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request/${encodeURIComponent(friendId)}`, {});
  }

  acceptBattle(battleId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/accept`, {});
  }

  rejectBattle(battleId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/reject`, {});
  }

  getPendingBattles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pending`);
  }

  getBattle(battleId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${battleId}`);
  }

  connectBattleStream(battleId: number, token: string): EventSource | null {
    if (!this.isBrowser || typeof EventSource === 'undefined' || !token) {
      return null;
    }

    return new EventSource(`${this.apiUrl}/${battleId}/stream?token=${encodeURIComponent(token)}`);
  }

  submitAction(battleId: number, payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/action`, payload);
  }

  useBattleItem(battleId: number, bagItemId: number, targetAdquiredXuxemonId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/use-item`, {
      bag_item_id: bagItemId,
      target_adquired_xuxemon_id: targetAdquiredXuxemonId,
    });
  }

  usePracticeItem(bagItemId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/practice/use-item`, {
      bag_item_id: bagItemId,
    });
  }

  finishBattle(battleId: number, winnerId: string, loserXuxemonId?: number): Observable<any> {
    const body: Record<string, string | number> = {
      winner_id: winnerId,
    };

    if (typeof loserXuxemonId === 'number') {
      body['loser_xuxemon_id'] = loserXuxemonId;
    }

    return this.http.post(`${this.apiUrl}/${battleId}/finish`, body);
  }
}
