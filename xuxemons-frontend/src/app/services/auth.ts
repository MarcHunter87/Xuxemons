import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

interface AuthResponse {
  access_token?: string;
  user?: User;
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

  login(credentials: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        this.saveAuth(res);
        if (res.access_token) {
          this.router.navigate(['/'], { replaceUrl: true });
        }
      })
    );
  }

  logout(): void {
    const token = this.getToken();
    this.clearAuth();

    const options = token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};

    this.http.post(`${this.apiUrl}/logout`, {}, options).subscribe({
      error: () => {
      }
    });
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

  private clearAuth(): void {
    this.getStorage()?.removeItem('token');
    this.getStorage()?.removeItem('user');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }
}
