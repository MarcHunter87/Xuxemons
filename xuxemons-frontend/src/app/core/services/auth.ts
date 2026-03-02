import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'admin' | 'player';
  level: number;
  xp: number;
  win_streak: number;
}

export interface RegisterPayload {
  name: string;
  surname: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginPayload {
  id: string;
  password: string;
}

interface AuthResponse {
  access_token?: string;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:8001/api';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly userSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  user$ = this.userSubject.asObservable();

  private getStorage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }

  private getStoredUser(): User | null {
    const raw = this.getStorage()?.getItem('user');
    if (!raw) return null;
    try {
      const user = JSON.parse(raw) as User;
      // Ensure defaults even if not sent by old API versions or cleared local storage
      return {
        ...user,
        level: user.level || 1,
        xp: user.xp || 0,
        win_streak: user.win_streak || 0
      };
    } catch {
      return null;
    }
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, payload).pipe(
      tap((res: AuthResponse) => {
        this.saveAuth(res);
        if (res.access_token) {
          this.router.navigate(['/'], { replaceUrl: true });
        }
      })
    );
  }

  login(credentials: LoginPayload, rememberMe: boolean = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: AuthResponse) => {
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

  logout(): void {
    const hadToken = !!this.getToken();
    if (hadToken) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        next: () => this.clearLocalAuth(),
        error: () => this.clearLocalAuth(),
      });
    } else {
      this.clearLocalAuth();
    }
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

  getUser(): User | null {
    return this.getStoredUser();
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
    }
    if (res.user) {
      const userWithDefaults: User = {
        ...res.user,
        level: res.user.level || 1,
        xp: res.user.xp || 0,
        win_streak: res.user.win_streak || 0
      };
      this.getStorage()?.setItem('user', JSON.stringify(userWithDefaults));
      this.userSubject.next(userWithDefaults);
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
      tap((res: { user: User }) => {
        const userWithDefaults: User = {
          ...res.user,
          level: res.user.level || 1,
          xp: res.user.xp || 0,
          win_streak: res.user.win_streak || 0
        };
        this.getStorage()?.setItem('user', JSON.stringify(userWithDefaults));
        this.userSubject.next(userWithDefaults);
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
}
