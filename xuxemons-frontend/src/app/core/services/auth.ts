import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, tap, BehaviorSubject } from 'rxjs';
import { delay, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import type {
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = this.isBrowser ? 'http://localhost:8080/api' : 'http://backend/api';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  user$ = this.userSubject.pipe(delay(0));

  private getStorage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }

  private getStoredUser(): User | null {
    const raw = this.getStorage()?.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }

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

  private clearLocalAuth(): void {
    this.getStorage()?.removeItem('token');
    this.getStorage()?.removeItem('user');
    this.userSubject.next(null);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  getToken(): string | null {
    return this.getStorage()?.getItem('token') ?? null;
  }
  
  getAssetUrl(path: string, cacheBust?: string): string {
    const base = this.apiUrl.replace(/\/api\/?$/, '') || this.apiUrl;
    const p = path.startsWith('/') ? path : `/${path}`;
    const encoded = p.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `${base}${encoded}`;
    return cacheBust ? `${url}?v=${encodeURIComponent(cacheBust)}` : url;
  }

  getUser(): User | null {
    return this.getStoredUser();
  }

  refreshUserFromApi(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/user`).pipe(
      tap(user => {
        this.getStorage()?.setItem('user', JSON.stringify(user));
        this.userSubject.next(user);
      }),
      catchError(() => of(null)),
    );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.getStoredUser()?.role === 'admin';
  }

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

  setRememberedCredentials(id: string, password: string): void {
    this.getStorage()?.setItem('rememberedCredentials', JSON.stringify({ id, password }));
  }

  clearRememberedCredentials(): void {
    this.getStorage()?.removeItem('rememberedCredentials');
  }

  updateProfile(data: Partial<User & { password?: string }>): Observable<{ user: User }> {
    return this.http.put<{ user: User }>(`${this.apiUrl}/profile`, data).pipe(
      tap(res => {
        this.getStorage()?.setItem('user', JSON.stringify(res.user));
        this.userSubject.next(res.user);
      })
    );
  }

  updatePersonalInfo(data: UpdatePersonalInfoPayload): Observable<UpdatePersonalInfoResponse> {
    return this.http.put<UpdatePersonalInfoResponse>(`${this.apiUrl}/profile/personalinfo`, data).pipe(
      tap(res => {
        this.getStorage()?.setItem('user', JSON.stringify(res.user));
        this.userSubject.next(res.user);
      })
    );
  }

  updatePassword(data: UpdatePasswordPayload): Observable<UpdatePasswordResponse> {
    return this.http.put<UpdatePasswordResponse>(`${this.apiUrl}/profile/updatePassword`, data);
  }

  deactivateAccount(): Observable<DeactivateAccountResponse> {
    return this.http.put<DeactivateAccountResponse>(`${this.apiUrl}/profile/deactivateAccount`, {}).pipe(
      tap(() => {
        this.clearLocalAuth();
      })
    );
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/profile`).pipe(
      tap(() => {
        this.clearLocalAuth();
      })
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

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

  uploadBanner(file: File): Observable<{ message: string; user: User }> {
    return this.uploadProfileImage(file, 'banner');
  }

  uploadIcon(file: File): Observable<{ message: string; user: User }> {
    return this.uploadProfileImage(file, 'icon');
  }
}
