import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FilterXuxedex } from '../../core/components/filter-xuxedex/filter-xuxedex';
import { Xuxemon, XuxemonService } from '../../core/services/xuxemon.service';
import { XuxemonCard } from '../../core/components/xuxemon-card/xuxemon-card';
import { AuthService } from '../../core/services/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-xuxedex',
  imports: [FilterXuxedex, XuxemonCard],
  templateUrl: './xuxedex.html',
  styleUrl: './xuxedex.css',
})
export class Xuxedex implements OnInit, OnDestroy {
  public xuxemonService = inject(XuxemonService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subs = new Subscription();
  private hasInitializedFiltered = false;
  private pendingOpenXuxemonId = signal<number | null>(null);

  readonly displayXuxemons = signal<Xuxemon[]>([]);
  readonly myXuxemons = signal<Xuxemon[]>([]);
  typeChartUrl = this.authService.getAssetUrl('/badges/Tabla De Tipos.webp');

  myXuxemonsSortedByName = computed(() =>
    [...this.myXuxemons()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  );

  filteredMyXuxemons = signal<Xuxemon[]>([]);

  private readonly itemsPerPage = 18;

  xuxemons = computed(() => this.displayXuxemons());

  // Pagination for My Team
  myXuxemonsCurrentPage = signal(0);
  paginatedMyXuxemons = computed(() => {
    const start = this.myXuxemonsCurrentPage() * this.itemsPerPage;
    return this.filteredMyXuxemons().slice(start, start + this.itemsPerPage);
  });
  myXuxemonsTotalPages = computed(() => Math.ceil(this.filteredMyXuxemons().length / this.itemsPerPage));

  // Pagination for Xuxedex
  xuxemonsCurrentPage = signal(0);
  paginatedXuxemons = computed(() => {
    const start = this.xuxemonsCurrentPage() * this.itemsPerPage;
    return this.xuxemons().slice(start, start + this.itemsPerPage);
  });
  xuxemonsTotalPages = computed(() => Math.ceil(this.xuxemons().length / this.itemsPerPage));

  // Sirve para filtrar los Xuxemons de My Team
  onMyXuxemonsFilteredChange(xuxemons: Xuxemon[]): void {
    this.filteredMyXuxemons.set(xuxemons);
    this.myXuxemonsCurrentPage.set(0);
    this.hasInitializedFiltered = true;
    this.tryOpenPendingXuxemon();
  }

  // Sirve para navegar entre las páginas de My Team
  nextMyXuPage() {
    if (this.myXuxemonsCurrentPage() < this.myXuxemonsTotalPages() - 1) {
      this.myXuxemonsCurrentPage.update(p => p + 1);
    }
  }

  // Sirve para navegar entre las páginas de My Team
  prevMyXuPage() {
    if (this.myXuxemonsCurrentPage() > 0) {
      this.myXuxemonsCurrentPage.update(p => p - 1);
    }
  }

  // Sirve para navegar entre las páginas de Xuxedex
  nextXuPage() {
    if (this.xuxemonsCurrentPage() < this.xuxemonsTotalPages() - 1) {
      this.xuxemonsCurrentPage.update(p => p + 1);
    }
  }

  // Sirve para navegar entre las páginas de Xuxedex
  prevXuPage() {
    if (this.xuxemonsCurrentPage() > 0) {
      this.xuxemonsCurrentPage.update(p => p - 1);
    }
  }

  // Sirve para verificar si un Xuxemon está capturado
  userXuxemonIds = computed(() => new Set(this.myXuxemons().map(x => x.id)));

  // Sirve para verificar si un Xuxemon está capturado
  isXuxemonCaptured(xuxemonId: number): boolean {
    return this.userXuxemonIds().has(xuxemonId);
  }

  // Sirve para inicializar el componente
  ngOnInit() {
    this.xuxemonService.setTypeInventory('all');
    this.xuxemonService.loadAllXuxemons();
    this.xuxemonService.loadMyXuxemons();
    this.subs.add(this.xuxemonService.displayXuxemons.subscribe(list => this.displayXuxemons.set(list)));
    this.subs.add(this.xuxemonService.myXuxemonsList.subscribe(list => {
      this.myXuxemons.set(list);
      if (!this.hasInitializedFiltered) {
        this.filteredMyXuxemons.set([...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')));
      }
      this.tryOpenPendingXuxemon();
    }));
    this.subs.add(this.route.queryParamMap.subscribe(params => {
      const raw = params.get('openXuxemonId');
      const parsed = raw ? Number(raw) : NaN;
      this.pendingOpenXuxemonId.set(Number.isFinite(parsed) ? parsed : null);
      this.tryOpenPendingXuxemon();
    }));
  }

  // Sirve para destruir el componente
  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  // Sirve para abrir el Xuxemon pendiente
  private tryOpenPendingXuxemon(): void {
    const targetId = this.pendingOpenXuxemonId();
    if (!targetId) return;

    const list = this.filteredMyXuxemons();
    const targetIndex = list.findIndex(x => x.id === targetId);
    if (targetIndex < 0) return;

    const targetPage = Math.floor(targetIndex / this.itemsPerPage);
    if (this.myXuxemonsCurrentPage() !== targetPage) {
      this.myXuxemonsCurrentPage.set(targetPage);
    }

    // Sirve para abrir el Xuxemon pendiente
    setTimeout(() => {
      const trigger = document.querySelector(`[data-my-xuxemon-id="${targetId}"] .card-button`) as HTMLElement | null;
      if (!trigger) return;

      trigger.click();
      this.pendingOpenXuxemonId.set(null);
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { openXuxemonId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }, 0);
  }
}
