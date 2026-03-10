import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../core/services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  console.log('🔍 Interceptor - getToken() retornó:', token ? `"${token.substring(0, 20)}..."` : 'null');
  console.log('📍 Interceptor - URL:', req.url);

  if (token) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.log('✅ JWT en petición:', req.method, req.url);
    }
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(authReq);
  }

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    console.log('❌ Sin token, petición sin Authorization:', req.method, req.url);
  }
  return next(req);
};
