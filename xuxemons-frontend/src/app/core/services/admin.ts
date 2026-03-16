import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { AdminUser, BagStatus, Item } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = isPlatformBrowser(this.platformId) ? 'http://localhost:8080/api' : 'http://backend/api';

  getAllUsers(): Observable<{ data: AdminUser[] }> {
    return this.http.get<{ data: AdminUser[] }>(`${this.apiUrl}/users`);
  }

  checkBagStatus(userId: string): Observable<{ data: BagStatus }> {
    const encodedUserId = encodeURIComponent(userId);
    return this.http.get<{ data: BagStatus }>(`${this.apiUrl}/users/${encodedUserId}/bag-status`);
  }

  getAllItems(): Observable<{ data: Item[] }> {
    return this.http.get<{ data: Item[] }>(`${this.apiUrl}/items`);
  }
  
  getAllXuxemons(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/xuxemons`);
  }

  deleteItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/items/${id}`);
  }

  deleteXuxemon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/xuxemons/${id}`);
  }

  giveItemToUser(userId: string, itemId: number, quantity: number): Observable<any> {
    const encodedUserId = encodeURIComponent(userId);
    return this.http.post(`${this.apiUrl}/users/${encodedUserId}/give-item`, {
      item_id: itemId,
      quantity: quantity,
    });
  }

  awardRandomXuxemonToUser(userId: string): Observable<any> {
    const encoded = encodeURIComponent(userId);
    return this.http.post<any>(`${this.apiUrl}/users/${encoded}/award-random`, {});
  }
}
