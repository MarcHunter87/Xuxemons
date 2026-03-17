import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../core/services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.log('JWT present in request:', req.method, req.url);
    }
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(authReq);
  }

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    console.log('No token, request without Authorization header:', req.method, req.url);
  }
  return next(req);
};
