import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { AuthService } from '../core/services/auth';
import { LoadingService } from '../core/services/loading.service';

type HttpErrorKind = 'unauthorized' | 'forbidden' | 'network' | 'server' | 'client' | 'unknown';

const classifyHttpError = (error: HttpErrorResponse): HttpErrorKind => {
  if (error.status === 401) {
    return 'unauthorized';
  }

  if (error.status === 403) {
    return 'forbidden';
  }

  if (error.status === 0) {
    return 'network';
  }

  if (error.status >= 500) {
    return 'server';
  }

  if (error.status >= 400) {
    return 'client';
  }

  return 'unknown';
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const loadingService = inject(LoadingService);
  const token = authService.getToken();
  const isAuthRequest = /\/(login|register|logout)(\?|$)/.test(req.url);
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

  loadingService.start();

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorKind = classifyHttpError(error);
      const shouldRedirectToLogin =
        (errorKind === 'unauthorized' || errorKind === 'forbidden') && !isAuthRequest;

      if (shouldRedirectToLogin) {
        authService.logout().subscribe({
          error: () => {},
        });
      }

      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.error('HTTP error intercepted:', {
          kind: errorKind,
          method: req.method,
          url: req.url,
          status: error.status,
        });
      }

      return throwError(() => error);
    }),
    finalize(() => loadingService.stop())
  );
};
