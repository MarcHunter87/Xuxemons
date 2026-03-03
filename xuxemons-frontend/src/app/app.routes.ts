import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Battle } from './pages/battle/battle';
import { Xuxedex } from './pages/xuxedex/xuxedex';
import { Inventory } from './pages/inventory/inventory';
import { Friends } from './pages/friends/friends';
import { Profile } from './pages/profile/profile';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { Admin } from './pages/admin/admin';
import { authGuard } from './guard/auth-guard';
import { adminGuard } from './guard/admin-guard';
import { Register } from './pages/auth/register/register';
import { Login } from './pages/auth/login/login';

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
    canActivate: [authGuard],
    children: [
      { path: '', component: Profile },
      { path: 'edit', component: EditProfile }
    ]
  },
  {
    path: 'admin',
    component: Admin,
    canActivate: [authGuard, adminGuard]
  }
];
