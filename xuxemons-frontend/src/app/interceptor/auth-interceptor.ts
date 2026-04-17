import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../core/services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const isAuthRequest = /\/(login|register)(\?|$)/.test(req.url);
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  if (token) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      console.log('JWT present in request:', req.method, req.url);
    }
  } else if (typeof ngDevMode === 'undefined' || ngDevMode) {
    console.log('No token, request without Authorization header:', req.method, req.url);
  }

  return next(request).pipe(
    catchError((error) => {
      const shouldRedirectToLogin = (error.status === 401 || error.status === 403) && !isAuthRequest;
      if (shouldRedirectToLogin) {
        authService.handleUnauthorizedSession();
      }
      return throwError(() => error);
    })
  );
};
