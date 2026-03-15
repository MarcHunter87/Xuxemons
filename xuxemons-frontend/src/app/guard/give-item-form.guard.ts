import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AdminService } from '../core/services/admin';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

export const giveItemFormGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const adminService = inject(AdminService);
  const router = inject(Router);

  const raw = route.paramMap.get('userId');
  if (!raw) {
    return router.parseUrl('/admin');
  }
  const userId = decodeURIComponent(raw);

  return adminService.checkBagStatus(userId).pipe(
    map((response) => {
      const { used_slots, max_slots } = response.data;
      if (used_slots >= max_slots) {
        return router.parseUrl('/admin');
      }
      return true;
    }),
    catchError(() => {
      return of(router.parseUrl('/admin'));
    })
  );
};
