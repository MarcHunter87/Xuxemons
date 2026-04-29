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
import { AdminSideeffects } from './pages/admin-pages/admin-sideeffects/admin-sideeffects';
import { AdminEditSideeffects } from './pages/admin-pages/admin-edit-sideeffects/admin-edit-sideeffects';
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
    title: 'Home',
  },
  {
    path: 'register',
    component: Register,
    title: 'Register',
  },
  {
    path: 'login',
    component: Login,
    title: 'Login',
  },
  {
    path: 'battle',
    component: Battle,
    canActivate: [authGuard],
    title: 'Battle',
  },
  {
    path: 'gacha',
    component: Gacha,
    canActivate: [authGuard],
    title: 'Gacha',
  },
  {
    path: 'xuxedex',
    component: Xuxedex,
    canActivate: [authGuard],
    title: 'Xuxedex',
  },
  {
    path: 'inventory',
    component: Inventory,
    canActivate: [authGuard],
    title: 'Inventory',
  },
  {
    path: 'friends',
    component: Friends,
    canActivate: [authGuard],
    title: 'Friends',
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    children: [
      { path: '', component: Profile, title: 'Profile' },
      { path: 'edit', component: EditProfile, title: 'Edit Profile' },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', component: Admin, title: 'Admin Panel' },
      {
        path: 'items',
        children: [
          { path: '', component: AdminItems, title: 'Admin Items' },
          { path: 'new-item', component: AdminNewItem, title: 'New Item' },
          { path: 'edit-item/:id', component: AdminEditItem, title: 'Edit Item' },
        ],
      },
      {
        path: 'xuxemons',
        children: [
          { path: '', component: AdminXuxemons, title: 'Admin Xuxemons' },
          { path: 'new-xuxemon', component: AdminNewXuxemon, title: 'New Xuxemon' },
          { path: 'edit-xuxemon/:id', component: AdminEditXuxemon, title: 'Edit Xuxemon' },
        ],
      },
      {
        path: 'give-item/:userId',
        component: AdminGiveItem,
        canActivate: [adminGiveItemGuard],
        title: 'Give Item',
      },
      {
        path: 'evolve',
        children: [
          { path: '', component: AdminEvolve, title: 'Evolution Sizes' },
          { path: 'edit-evolve/:id', component: AdminEditEvolve, title: 'Edit Evolution' },
        ],
      },
      {
        path: 'daily-rewards',
        children: [
          { path: '', component: AdminDailyreward, title: 'Daily Rewards' },
          { path: 'edit/:id', component: AdminDailyrewardEdit, title: 'Edit Daily Reward' },
        ],
      },
      {
        path: 'side-effects',
        children: [
          { path: '', component: AdminSideeffects, title: 'Side Effects' },
          { path: 'edit/:id', component: AdminEditSideeffects, title: 'Edit Side Effect' },
        ],
      },
    ],
  },
  {
    path: 'NotFound',
    component: NotFound,
    title: '404 Not Found',
  },
  {
    path: '**',
    redirectTo: '/NotFound',
    pathMatch: 'full'
  },
];
