import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = this.isBrowser ? 'http://localhost:8080/api/team' : 'http://backend/api/team';
  private readonly http = inject(HttpClient);

  getTeam(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  updateSlot(slotNumber: number, adquiredXuxemonId: number | null): Observable<any> {
    return this.http.post(`${this.apiUrl}/slot/${slotNumber}`, {
      adquired_xuxemon_id: adquiredXuxemonId
    });
  }
}