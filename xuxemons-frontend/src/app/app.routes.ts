import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Battle } from './pages/battle/battle';
import { Gacha } from './pages/gacha/gacha';
import { Xuxedex } from './pages/xuxedex/xuxedex';
import { Inventory } from './pages/inventory/inventory';
import { Friends } from './pages/friends/friends';
import { Profile } from './pages/profile/profile';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { Admin } from './pages/admin-pages/admin/admin';
import { AdminItems } from './pages/admin-pages/admin-items/admin-items';
import { AdminXuxemons } from './pages/admin-pages/admin-xuxemons/admin-xuxemons';
import { AdminNewItem } from './pages/admin-pages/admin-new-item/admin-new-item';
import { AdminNewXuxemon } from './pages/admin-pages/admin-new-xuxemon/admin-new-xuxemon';
import { AdminEditItem } from './pages/admin-pages/admin-edit-item/admin-edit-item';
import { AdminEditXuxemon } from './pages/admin-pages/admin-edit-xuxemon/admin-edit-xuxemon';
import { AdminEvolve } from './pages/admin-pages/admin-evolve/admin-evolve';
import { AdminEditEvolve } from './pages/admin-pages/admin-edit-evolve/admin-edit-evolve';
import { AdminGiveItem } from './pages/admin-pages/admin-give-item/admin-give-item';
import { AdminDailyreward } from './pages/admin-pages/admin-dailyreward/admin-dailyreward';
import { AdminDailyrewardEdit } from './pages/admin-pages/admin-edit-dailyreward/admin-edit-dailyreward';
import { authGuard } from './guard/auth-guard';
import { adminGuard } from './guard/admin-guard';
import { adminGiveItemGuard } from './guard/admin-give-item.guard';
import { Register } from './pages/auth/register/register';
import { Login } from './pages/auth/login/login';
import { NotFound } from './pages/not-found/not-found';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    canActivate: [authGuard],
  },
  {
    path: 'register',
    component: Register,
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'battle',
    component: Battle,
    canActivate: [authGuard],
  },
  {
    path: 'gacha',
    component: Gacha,
    canActivate: [authGuard],
  },
  {
    path: 'xuxedex',
    component: Xuxedex,
    canActivate: [authGuard],
  },
  {
    path: 'inventory',
    component: Inventory,
    canActivate: [authGuard],
  },
  {
    path: 'friends',
    component: Friends,
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    children: [{ path: '', component: Profile }, { path: 'edit', component: EditProfile }],
  },
  {
    path: 'NotFound',
    component: NotFound
  },
  {
    path: '**',
    redirectTo: '/NotFound',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', component: Admin },
      {
        path: 'items',
        children: [
          { path: '', component: AdminItems },
          { path: 'new-item', component: AdminNewItem },
          { path: 'edit-item/:id', component: AdminEditItem },
        ],
      },
      {
        path: 'xuxemons',
        children: [
          { path: '', component: AdminXuxemons },
          { path: 'new-xuxemon', component: AdminNewXuxemon },
          { path: 'edit-xuxemon/:id', component: AdminEditXuxemon },
        ],
      },
      {
        path: 'give-item/:userId',
        component: AdminGiveItem,
        canActivate: [adminGiveItemGuard],
      },
      {
        path: 'evolve',
        children: [
          { path: '', component: AdminEvolve },
          { path: 'edit-evolve/:id', component: AdminEditEvolve },
        ],
      },
      {
        path: 'daily-rewards',
        children: [
          { path: '', component: AdminDailyreward },
          { path: 'edit/:id', component: AdminDailyrewardEdit },
        ],
      },
    ],
  },
];
