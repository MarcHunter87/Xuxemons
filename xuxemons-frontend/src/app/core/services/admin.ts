import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { AdminCreationMeta, AdminUser, BagStatus, DailyReward, Item, SideEffect } from '../interfaces';

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

  banUser(userId: string): Observable<{ message: string }> {
    const encodedUserId = encodeURIComponent(userId);
    return this.http.put<{ message: string }>(`${this.apiUrl}/users/${encodedUserId}/ban`, {});
  }

  getAllItems(): Observable<{ data: Item[] }> {
    return this.http.get<{ data: Item[] }>(`${this.apiUrl}/items`);
  }
  
  getAllXuxemons(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/xuxemons`);
  }

  getCreationMeta(): Observable<{ data: AdminCreationMeta }> {
    return this.http.get<{ data: AdminCreationMeta }>(`${this.apiUrl}/admin/meta`);
  }

  deleteItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/items/${id}`);
  }

  deleteXuxemon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/xuxemons/${id}`);
  }

  getItem(id: number): Observable<{ data: Item }> {
    return this.http.get<{ data: Item }>(`${this.apiUrl}/admin/items/${id}`);
  }

  getXuxemon(id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.apiUrl}/admin/xuxemons/${id}`);
  }

  createItem(formData: FormData): Observable<{ message: string; data: Item }> {
    return this.http.post<{ message: string; data: Item }>(`${this.apiUrl}/admin/items`, formData);
  }

  updateItem(id: number, formData: FormData): Observable<{ message: string; data: Item }> {
    return this.http.put<{ message: string; data: Item }>(`${this.apiUrl}/admin/items/${id}`, formData);
  }

  createXuxemon(formData: FormData): Observable<{ message: string; data: any }> {
    return this.http.post<{ message: string; data: any }>(`${this.apiUrl}/admin/xuxemons`, formData);
  }

  updateXuxemon(id: number, formData: FormData): Observable<{ message: string; data: any }> {
    return this.http.put<{ message: string; data: any }>(`${this.apiUrl}/admin/xuxemons/${id}`, formData);
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

  getAllSizes(): Observable<{ data: Array<{ id: number; size: string; requirement_progress: number }> }> {
    return this.http.get<{ data: Array<{ id: number; size: string; requirement_progress: number }> }>(
      `${this.apiUrl}/admin/sizes`,
    );
  }

  getSize(id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.apiUrl}/admin/sizes/${id}`);
  }

  updateSize(id: number, data: any): Observable<{ message: string; data: any }> {
    return this.http.put<{ message: string; data: any }>(`${this.apiUrl}/admin/sizes/${id}`, data);
  }

  getAllDailyRewards(): Observable<{ data: DailyReward[] }> {
    return this.http.get<{ data: DailyReward[] }>(`${this.apiUrl}/admin/daily-rewards`);
  }

  getDailyReward(id: number): Observable<{ data: DailyReward }> {
    return this.http.get<{ data: DailyReward }>(`${this.apiUrl}/admin/daily-rewards/${id}`);
  }

  updateDailyReward(id: number, data: { time: string; quantity: number }): Observable<{ message: string; data: DailyReward }> {
    return this.http.put<{ message: string; data: DailyReward }>(`${this.apiUrl}/admin/daily-rewards/${id}`, data);
  }

  processDailyItems(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/process-daily-items`, {});
  }

  processDailyXuxemons(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/process-daily-xuxemons`, {});
  }

  processDailyAll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/process-daily-all`, {});
  }

  getAllSideEffects(): Observable<{ data: SideEffect[] }> {
    return this.http.get<{ data: SideEffect[] }>(`${this.apiUrl}/admin/side-effects`);
  }

  getSideEffect(id: number): Observable<{ data: SideEffect }> {
    return this.http.get<{ data: SideEffect }>(`${this.apiUrl}/admin/side-effects/${id}`);
  }

  updateSideEffect(id: number, data: { apply_chance: number | null }): Observable<{ message: string; data: SideEffect }> {
    return this.http.put<{ message: string; data: SideEffect }>(`${this.apiUrl}/admin/side-effects/${id}`, data);
  }
}
