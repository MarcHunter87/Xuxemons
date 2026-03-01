import { Routes } from '@angular/router';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { Home } from './pages/home/home';
import { Battle } from './pages/battle/battle';
import { Xuxedex } from './pages/xuxedex/xuxedex';
import { Inventory } from './pages/inventory/inventory';
import { Friends } from './pages/friends/friends';
import { Profile } from './pages/profile/profile';
import { Admin } from './pages/admin/admin';
import { authGuard } from './guard/auth-guard';
import { adminGuard } from './guard/admin-guard';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    canActivate: [authGuard]
  },
  {
    path: 'register',
    component: Register
  },
  {
    path: 'login',
    component: Login
  },
  {
    path: 'battle',
    component: Battle,
    canActivate: [authGuard]
  },
  {
    path: 'xuxedex',
    component: Xuxedex,
    canActivate: [authGuard]
  },
  {
    path: 'inventory',
    component: Inventory,
    canActivate: [authGuard]
  },
  {
    path: 'friends',
    component: Friends,
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    component: Profile,
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    component: Admin,
    canActivate: [authGuard, adminGuard]
  }
];
