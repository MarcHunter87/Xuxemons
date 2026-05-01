import { CanDeactivateFn } from '@angular/router';
import { Battle } from '../pages/battle/battle';

export const battleDeactivateGuard: CanDeactivateFn<Battle> = (component) => {
  return component.canDeactivate();
};
