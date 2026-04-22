import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, tap, BehaviorSubject } from 'rxjs';
import { delay, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import type {
  DailyRewardNotification,
  DailyRewardNotificationResponse,
  User,
  RegisterPayload,
  LoginPayload,
  UpdatePersonalInfoPayload,
  UpdatePasswordPayload,
  AuthResponse,
  UpdatePersonalInfoResponse,
  UpdatePasswordResponse,
  DeactivateAccountResponse,
} from '../interfaces';

export type { User, RegisterPayload, LoginPayload, UpdatePersonalInfoPayload, UpdatePasswordPayload };

// Sirve para verificar si el token está expirado
type JwtPayload = { exp?: number };

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = this.isBrowser ? 'http://localhost:8080/api' : 'http://backend/api';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userSubject = new BehaviorSubject<User | null>(this.readInitialUser());
  user$ = this.userSubject.pipe(delay(0));

  readonly gachaTicketCount = signal(0);

  // Sirve para establecer el número de tickets de gacha
  setGachaTicketCount(n: number): void {
    this.gachaTicketCount.set(Math.max(0, Math.floor(n)));
  }

  // Sirve para actualizar el número de tickets de gacha
  refreshGachaTickets(): void {
    if (!this.isBrowser || !this.getToken()) {
      this.gachaTicketCount.set(0);
      return;
    }
    this.http.get<{ data: { quantity: number } }>(`${this.apiUrl}/inventory/gacha-tickets`).subscribe({
      next: (r) => this.gachaTicketCount.set(r.data?.quantity ?? 0),
      error: () => this.gachaTicketCount.set(0),
    });
  }

  // Sirve para obtener el storage
  private getStorage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }

  // Sirve para limpiar la sesión local cuando el token ha expirado
  private clearExpiredLocalAuth(): void {
    this.getStorage()?.removeItem('token');
    this.getStorage()?.removeItem('user');
    this.gachaTicketCount.set(0);
    this.userSubject.next(null);
  }

  // Sirve para leer el usuario inicial desde el local storage
  private readInitialUser(): User | null {
    const token = this.getStorage()?.getItem('token');
    if (!token) {
      return null;
    }
    if (!this.isAccessTokenValid(token)) {
      this.getStorage()?.removeItem('token');
      this.getStorage()?.removeItem('user');
      return null;
    }
    const raw = this.getStorage()?.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }

  // Sirve para verificar si el token de acceso es válido
  private isAccessTokenValid(token: string): boolean {
    try {
      const payload = jwtDecode<JwtPayload>(token);
      if (typeof payload.exp !== 'number') {
        return true;
      }
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // Sirve para obtener el usuario almacenado
  private getStoredUser(): User | null {
    if (!this.getToken()) {
      return null;
    }
    const raw = this.getStorage()?.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }

  // Sirve para registrar un nuevo usuario
  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, payload).pipe(
      tap(res => {
        this.saveAuth(res);
        if (res.access_token) {
          this.router.navigate(['/'], { replaceUrl: true });
        }
      })
    );
  }

  // Sirve para iniciar sesión
  login(credentials: LoginPayload, rememberMe: boolean = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        this.saveAuth(res);
        if (res.access_token) {
          if (rememberMe) {
            this.setRememberedCredentials(credentials.id, credentials.password);
          } else {
            this.clearRememberedCredentials();
          }
          this.router.navigate(['/'], { replaceUrl: true });
        }
      })
    );
  }

  // Sirve para cerrar sesión
  logout(): Observable<void> {
    const hadToken = !!this.getToken();
    if (hadToken) {
      return this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(
        tap(() => this.clearLocalAuth()),
        catchError(() => {
          this.clearLocalAuth();
          return of(undefined);
        }),
        map(() => undefined)
      );
    }
    this.clearLocalAuth();
    return of(undefined);
  }

  // Sirve para limpiar la sesión local
  private clearLocalAuth(): void {
    this.getStorage()?.removeItem('token');
    this.getStorage()?.removeItem('user');
    this.refreshGachaTickets();
    this.userSubject.next(null);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  // Sirve para obtener el token de acceso
  getToken(): string | null {
    const token = this.getStorage()?.getItem('token') ?? null;
    if (!token) {
      return null;
    }
    if (!this.isAccessTokenValid(token)) {
      this.clearExpiredLocalAuth();
      return null;
    }
    return token;
  }
  
  // Sirve para obtener la URL del asset
  getAssetUrl(path: string, cacheBust?: string): string {
    const base = this.apiUrl.replace(/\/api\/?$/, '') || this.apiUrl;
    const p = path.startsWith('/') ? path : `/${path}`;
    const encoded = p.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `${base}${encoded}`;
    return cacheBust ? `${url}?v=${encodeURIComponent(cacheBust)}` : url;
  }

  // Sirve para obtener el usuario
  getUser(): User | null {
    return this.getStoredUser();
  }

  // Sirve para actualizar el usuario desde la API
  refreshUserFromApi(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/user`).pipe(
      tap(user => {
        this.getStorage()?.setItem('user', JSON.stringify(user));
        this.userSubject.next(user);
      }),
      catchError(() => of(null)),
    );
  }

  // Sirve para verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Sirve para verificar si el usuario es administrador
  isAdmin(): boolean {
    return this.getStoredUser()?.role === 'admin';
  }
  
  // Sirve para manejar la sesión no autorizada
  handleUnauthorizedSession(): void {
    this.clearLocalAuth();
  }

  // Sirve para guardar la autenticación
  private saveAuth(res: AuthResponse): void {
    if (res.access_token) {
      this.getStorage()?.setItem('token', res.access_token);
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.log('JWT stored in localStorage (login/register)');
      }
    }
    if (res.user) {
      this.getStorage()?.setItem('user', JSON.stringify(res.user));
      this.userSubject.next(res.user);
    }
  }

  // Sirve para obtener las credenciales recordadas
  getRememberedCredentials(): { id: string; password: string } | null {
    const raw = this.getStorage()?.getItem('rememberedCredentials');
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as { id: string; password: string };
      return data?.id != null && data?.password != null ? data : null;
    } catch {
      return null;
    }
  }

  // Sirve para establecer las credenciales recordadas
  setRememberedCredentials(id: string, password: string): void {
    this.getStorage()?.setItem('rememberedCredentials', JSON.stringify({ id, password }));
  }

  // Sirve para limpiar las credenciales recordadas
  clearRememberedCredentials(): void {
    this.getStorage()?.removeItem('rememberedCredentials');
  }

  // Sirve para actualizar el perfil
  updateProfile(data: Partial<User & { password?: string }>): Observable<{ user: User }> {
    return this.http.put<{ user: User }>(`${this.apiUrl}/profile`, data).pipe(
      tap(res => {
        this.getStorage()?.setItem('user', JSON.stringify(res.user));
        this.userSubject.next(res.user);
      })
    );
  }

  // Sirve para actualizar la información personal
  updatePersonalInfo(data: UpdatePersonalInfoPayload): Observable<UpdatePersonalInfoResponse> {
    return this.http.put<UpdatePersonalInfoResponse>(`${this.apiUrl}/profile/personalinfo`, data).pipe(
      tap(res => {
        this.getStorage()?.setItem('user', JSON.stringify(res.user));
        this.userSubject.next(res.user);
      })
    );
  }

  // Sirve para actualizar la contraseña
  updatePassword(data: UpdatePasswordPayload): Observable<UpdatePasswordResponse> {
    return this.http.put<UpdatePasswordResponse>(`${this.apiUrl}/profile/updatePassword`, data);
  }

  // Sirve para desactivar la cuenta
  deactivateAccount(): Observable<DeactivateAccountResponse> {
    return this.http.put<DeactivateAccountResponse>(`${this.apiUrl}/profile/deactivateAccount`, {}).pipe(
      tap(() => {
        this.clearLocalAuth();
      })
    );
  }

  // Sirve para eliminar la cuenta
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/profile`).pipe(
      tap(() => {
        this.clearLocalAuth();
      })
    );
  }

  // Sirve para obtener los headers de autenticación
  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // Sirve para subir la imagen de perfil
  uploadProfileImage(file: File, type: 'banner' | 'icon'): Observable<{ message: string; user: User }> {
    const ext = (file.name.split('.').pop()?.toLowerCase() ?? 'png').replace(/[^a-z0-9]/g, '') || 'png';
    const formData = new FormData();
    formData.append(type, file, `${type}.${ext}`);
    return this.http.post<{ message: string; user: User }>(
      `${this.apiUrl}/profile/upload-${type}`,
      formData,
      { headers: this.authHeaders() }
    ).pipe(
      tap(res => {
        const user = { ...res.user, updated_at: new Date().toISOString() };
        this.getStorage()?.setItem('user', JSON.stringify(user));
        this.userSubject.next(user);
      })
    );
  }

  // Sirve para subir la imagen de banner
  uploadBanner(file: File): Observable<{ message: string; user: User }> {
    return this.uploadProfileImage(file, 'banner');
  }

  // Sirve para subir la imagen de icono
  uploadIcon(file: File): Observable<{ message: string; user: User }> {
    return this.uploadProfileImage(file, 'icon');
  }

  // Sirve para obtener la notificación de recompensa diaria pendiente
  getPendingDailyRewardNotification(): Observable<DailyRewardNotification | null> {
    return this.http.get<DailyRewardNotificationResponse>(
      `${this.apiUrl}/daily-rewards/pending`,
      { headers: this.authHeaders() }
    ).pipe(
      map(res => res.data ?? null),
    );
  }

  // Sirve para reconocer la notificación de recompensa diaria
  acknowledgeDailyRewardNotification(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/daily-rewards/${id}/ack`,
      {},
      { headers: this.authHeaders() }
    );
  }
}
