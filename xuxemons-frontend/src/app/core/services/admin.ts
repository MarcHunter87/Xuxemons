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

  // Sirve para obtener todos los usuarios
  getAllUsers(): Observable<{ data: AdminUser[] }> {
    return this.http.get<{ data: AdminUser[] }>(`${this.apiUrl}/users`);
  }

  // Sirve para verificar el estado de la bolsa del usuario
  checkBagStatus(userId: string): Observable<{ data: BagStatus }> {
    const encodedUserId = encodeURIComponent(userId);
    return this.http.get<{ data: BagStatus }>(`${this.apiUrl}/users/${encodedUserId}/bag-status`);
  }

  // Sirve para banear a un usuario
  banUser(userId: string): Observable<{ message: string }> {
    const encodedUserId = encodeURIComponent(userId);
    return this.http.put<{ message: string }>(`${this.apiUrl}/users/${encodedUserId}/ban`, {});
  }

  // Sirve para obtener todos los items
  getAllItems(): Observable<{ data: Item[] }> {
    return this.http.get<{ data: Item[] }>(`${this.apiUrl}/items`);
  }
  
  // Sirve para obtener todos los Xuxemons
  getAllXuxemons(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/xuxemons`);
  }

  // Sirve para obtener los metadatos de creación
  getCreationMeta(): Observable<{ data: AdminCreationMeta }> {
    return this.http.get<{ data: AdminCreationMeta }>(`${this.apiUrl}/admin/meta`);
  }

  // Sirve para eliminar un item
  deleteItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/items/${id}`);
  }

  // Sirve para eliminar un Xuxemon
  deleteXuxemon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/xuxemons/${id}`);
  }

  // Sirve para obtener un item
  getItem(id: number): Observable<{ data: Item }> {
    return this.http.get<{ data: Item }>(`${this.apiUrl}/admin/items/${id}`);
  }

  // Sirve para obtener un Xuxemon
  getXuxemon(id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.apiUrl}/admin/xuxemons/${id}`);
  }

  // Sirve para crear un item
  createItem(formData: FormData): Observable<{ message: string; data: Item }> {
    return this.http.post<{ message: string; data: Item }>(`${this.apiUrl}/admin/items`, formData);
  }

  // Sirve para actualizar un item
  updateItem(id: number, formData: FormData): Observable<{ message: string; data: Item }> {
    return this.http.put<{ message: string; data: Item }>(`${this.apiUrl}/admin/items/${id}`, formData);
  }

  // Sirve para crear un Xuxemon
  createXuxemon(formData: FormData): Observable<{ message: string; data: any }> {
    return this.http.post<{ message: string; data: any }>(`${this.apiUrl}/admin/xuxemons`, formData);
  }

  // Sirve para actualizar un Xuxemon
  updateXuxemon(id: number, formData: FormData): Observable<{ message: string; data: any }> {
    return this.http.put<{ message: string; data: any }>(`${this.apiUrl}/admin/xuxemons/${id}`, formData);
  }

  // Sirve para dar un item a un usuario
  giveItemToUser(userId: string, itemId: number, quantity: number): Observable<any> {
    const encodedUserId = encodeURIComponent(userId);
    return this.http.post(`${this.apiUrl}/users/${encodedUserId}/give-item`, {
      item_id: itemId,
      quantity: quantity,
    });
  }

  // Sirve para dar un Xuxemon aleatorio a un usuario
  awardRandomXuxemonToUser(userId: string): Observable<any> {
    const encoded = encodeURIComponent(userId);
    return this.http.post<any>(`${this.apiUrl}/users/${encoded}/award-random`, {});
  }

  // Sirve para obtener todos los tamaños
  getAllSizes(): Observable<{ data: Array<{ id: number; size: string; requirement_progress: number }> }> {
    return this.http.get<{ data: Array<{ id: number; size: string; requirement_progress: number }> }>(
      `${this.apiUrl}/admin/sizes`,
    );
  }

  // Sirve para obtener un tamaño
  getSize(id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.apiUrl}/admin/sizes/${id}`);
  }

  // Sirve para actualizar un tamaño
  updateSize(id: number, data: any): Observable<{ message: string; data: any }> {
    return this.http.put<{ message: string; data: any }>(`${this.apiUrl}/admin/sizes/${id}`, data);
  }

  // Sirve para obtener todas las recompensas diarias
  getAllDailyRewards(): Observable<{ data: DailyReward[] }> {
    return this.http.get<{ data: DailyReward[] }>(`${this.apiUrl}/admin/daily-rewards`);
  }

  // Sirve para obtener una recompensa diaria
  getDailyReward(id: number): Observable<{ data: DailyReward }> {
    return this.http.get<{ data: DailyReward }>(`${this.apiUrl}/admin/daily-rewards/${id}`);
  }

  // Sirve para actualizar una recompensa diaria
  updateDailyReward(id: number, data: { time: string; quantity: number }): Observable<{ message: string; data: DailyReward }> {
    return this.http.put<{ message: string; data: DailyReward }>(`${this.apiUrl}/admin/daily-rewards/${id}`, data);
  }

  // Sirve para procesar las recompensas diarias de items
  processDailyItems(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/process-daily-items`, {});
  }

  // Sirve para procesar las recompensas diarias de Xuxemons
  processDailyXuxemons(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/process-daily-xuxemons`, {});
  }

  // Sirve para procesar todas las recompensas diarias
  processDailyAll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/process-daily-all`, {});
  }

  // Sirve para obtener todos los efectos secundarios
  getAllSideEffects(): Observable<{ data: SideEffect[] }> {
    return this.http.get<{ data: SideEffect[] }>(`${this.apiUrl}/admin/side-effects`);
  }

  // Sirve para obtener un efecto secundario
  getSideEffect(id: number): Observable<{ data: SideEffect }> {
    return this.http.get<{ data: SideEffect }>(`${this.apiUrl}/admin/side-effects/${id}`);
  }

  // Sirve para actualizar un efecto secundario
  updateSideEffect(id: number, data: { apply_chance: number | null }): Observable<{ message: string; data: SideEffect }> {
    return this.http.put<{ message: string; data: SideEffect }>(`${this.apiUrl}/admin/side-effects/${id}`, data);
  }
}
