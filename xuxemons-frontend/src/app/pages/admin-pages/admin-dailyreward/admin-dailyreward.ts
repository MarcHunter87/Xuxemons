import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { DailyReward } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';

@Component({
  selector: 'app-admin-dailyreward',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dailyreward.html',
  styleUrl: './admin-dailyreward.css',
})
export class AdminDailyreward implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly rewards = signal<DailyReward[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());
  readonly isProcessing = signal(false);
  readonly isProcessingXux = signal(false);
  readonly isProcessingItems = signal(false);

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.loadRewards();
  }

  // Sirve para cargar las recompensas diarias
  private loadRewards(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getAllDailyRewards()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          const data = res?.data;
          const list = Array.isArray(data) ? [...data].sort((a, b) => a.id - b.id) : [];
          this.rewards.set(list);
          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading daily rewards');
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load daily rewards');
        },
      });
  }

  // Sirve para ejecutar todas las recompensas diarias
  runAll(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    this.adminService
      .processDailyAll()
      .pipe(finalize(() => this.isProcessing.set(false)))
      .subscribe({
        next: () => this.loadRewards(),
        error: (err) => console.error('Error running daily all', err),
      });
  }

  // Sirve para ejecutar la recompensa diaria de Xuxemon
  runXuxemon(): void {
    if (this.isProcessingXux()) return;
    this.isProcessingXux.set(true);
    this.adminService
      .processDailyXuxemons()
      .pipe(finalize(() => this.isProcessingXux.set(false)))
      .subscribe({
        next: () => this.loadRewards(),
        error: (err) => console.error('Error running daily xuxemon', err),
      });
  }

  // Sirve para ejecutar la recompensa diaria de Items
  runItems(): void {
    if (this.isProcessingItems()) return;
    this.isProcessingItems.set(true);
    this.adminService
      .processDailyItems()
      .pipe(finalize(() => this.isProcessingItems.set(false)))
      .subscribe({
        next: () => this.loadRewards(),
        error: (err) => console.error('Error running daily items', err),
      });
  }
}
