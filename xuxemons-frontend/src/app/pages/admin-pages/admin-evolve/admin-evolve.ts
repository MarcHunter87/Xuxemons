import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin';

export interface EvolveSizeRow {
  id: number;
  size: string;
  requirement_progress: number;
}

@Component({
  selector: 'app-admin-evolve',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-evolve.html',
  styleUrl: './admin-evolve.css',
})
export class AdminEvolve implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly sizes = signal<EvolveSizeRow[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.loadSizes();
  }

  // Sirve para cargar los tamaños de evolución
  private loadSizes(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .getAllSizes()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          const data = res?.data;
          const list = Array.isArray(data) ? [...data].sort((a, b) => a.id - b.id) : [];
          this.sizes.set(list);
          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading evolution sizes');
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load evolution sizes');
        },
      });
  }
}
