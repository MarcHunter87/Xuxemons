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
    return this.http.post(`${this.apiUrl}/request/${friendId}`, {});
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

  finishBattle(battleId: number, winnerId: string, loserXuxemonId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/finish`, {
      winner_id: winnerId,
      loser_xuxemon_id: loserXuxemonId
    });
  }
}