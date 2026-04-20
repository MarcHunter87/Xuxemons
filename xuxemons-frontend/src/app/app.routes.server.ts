import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'battle/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/items/edit-item/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/xuxemons/edit-xuxemon/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/give-item/:userId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/evolve/edit-evolve/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/daily-rewards/edit/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/side-effects/edit/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
