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

export interface UpdatePersonalInfoPayload {
  name: string;
  surname: string;
  email: string;
}

export interface UpdatePasswordPayload {
  current_password: string;
  new_password: string;
}

interface AuthResponse {
  access_token?: string;
  user?: User;
}

interface UpdatePersonalInfoResponse {
  message: string;
  user: User;
  errors?: Record<string, string[]>;
}

interface UpdatePasswordResponse {
  message: string;
  errors?: Record<string, string[]>;
}

interface DeactivateAccountResponse {
  message: string;
  errors?: Record<string, string[]>;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:8080/api';
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
}
