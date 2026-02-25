import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthServices {
  private apiUrl = '/api';
  private http = inject(HttpClient);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private userSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  user$ = this.userSubject.asObservable();

  private getStorage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }

  private getItem(key: string): string | null {
    const storage = this.getStorage();
    return storage ? storage.getItem(key) : null;
  }

  private setItem(key: string, value: string): void {
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(key, value);
    }
  }

  private removeItem(key: string): void {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(key);
    }
  }

  private getUserFromStorage(): User | null {
    const user = this.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  register(user: RegisterPayload): Observable<AuthResponse> {
    return this.http.post(`${this.apiUrl}/register`, user).pipe(
      tap((response: AuthResponse) => {
        if (response.access_token) {
          this.setItem('token', response.access_token);
          if (response.user) {
            this.setItem('user', JSON.stringify(response.user));
            this.userSubject.next(response.user);
          }
        }
      })
    );
  }

  login(credentials: LoginPayload): Observable<AuthResponse> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: AuthResponse) => {
        if (response.access_token) {
          this.setItem('token', response.access_token);
          if (response.user) {
            this.setItem('user', JSON.stringify(response.user));
            this.userSubject.next(response.user);
          }
        }
      })
    );
  }

  logout(): void {
    const token = this.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post(`${this.apiUrl}/logout`, {}, { headers }).subscribe({
      next: () => {
        this.clearAuth();
      },
      error: () => {
        this.clearAuth();
      }
    });
  }

  private clearAuth() {
    this.removeItem('token');
    this.removeItem('user');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.getItem('token');
  }

  getUser(): User | null {
    const user = this.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  updateProfile(data: UpdateProfilePayload): Observable<AuthResponse> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put(`${this.apiUrl}/profile`, data, { headers }).pipe(
      tap((response: AuthResponse) => {
        if (response.user) {
          this.setItem('user', JSON.stringify(response.user));
          this.userSubject.next(response.user);
        }
      })
    );
  }
}

type User = Record<string, unknown>;
type RegisterPayload = Record<string, unknown>;
type LoginPayload = Record<string, unknown>;
type UpdateProfilePayload = Record<string, unknown>;

type AuthResponse = {
  access_token?: string;
  user?: User;
};
