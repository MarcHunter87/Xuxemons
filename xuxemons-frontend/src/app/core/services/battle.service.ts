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

  // Sirve para crear una solicitud de batalla.
  requestBattle(friendId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request/${encodeURIComponent(friendId)}`, {});
  }

  // Sirve para aceptar una solicitud de batalla.
  acceptBattle(battleId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/accept`, {});
  }

  // Sirve para rechazar una solicitud de batalla.
  rejectBattle(battleId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/reject`, {});
  }

  // Sirve para listar las invitaciones de batalla pendientes para el usuario autenticado.
  getPendingBattles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pending`);
  }

  // Sirve para obtener los detalles de una batalla.
  getBattle(battleId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${battleId}`);
  }

  // Sirve para conectar a un stream de batalla.
  connectBattleStream(battleId: number, token: string): EventSource | null {
    if (!this.isBrowser || typeof EventSource === 'undefined' || !token) {
      return null;
    }

    // Sirve para crear un nuevo EventSource (objeto de JavaScript que permite la comunicación bidireccional con el servidor) para el stream de batalla.
    return new EventSource(`${this.apiUrl}/${battleId}/stream?token=${encodeURIComponent(token)}`);
  }

  // Sirve para enviar una acción de combate al servidor.
  submitAction(battleId: number, payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/action`, payload);
  }

  // Sirve para registrar la rendición automática de un jugador en una batalla.
  forfeit(battleId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/forfeit`, {});
  }

  // Sirve para registrar la desconexión automática de un jugador en una batalla.
  autoForfeitOnDisconnect(battleId: number, token: string): void {
    if (!this.isBrowser || !token) {
      return;
    }

    // Sirve para crear la URL de desconexión con el token de autenticación.
    const url = `${this.apiUrl}/${battleId}/disconnect?token=${encodeURIComponent(token)}`;

    // Sirve para enviar la desconexión a través de sendBeacon (método de JavaScript que permite enviar datos al servidor sin bloquear la navegación) si está disponible.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const beaconSent = navigator.sendBeacon(url);
      if (beaconSent) {
        return;
      }
    }

    // Sirve para enviar la desconexión a través de fetch si no hay sendBeacon.
    if (typeof fetch === 'function') {
      void fetch(url, {
        method: 'POST',
        body: '',
        keepalive: true,
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
      }).catch(() => undefined);
    }
  }

  // Sirve para usar un item de batalla en una batalla.
  useBattleItem(battleId: number, bagItemId: number, targetAdquiredXuxemonId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${battleId}/use-item`, {
      bag_item_id: bagItemId,
      target_adquired_xuxemon_id: targetAdquiredXuxemonId,
    });
  }

  // Sirve para usar un item de práctica en una batalla.
  usePracticeItem(bagItemId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/practice/use-item`, {
      bag_item_id: bagItemId,
    });
  }

  // Sirve para finalizar una batalla.
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
