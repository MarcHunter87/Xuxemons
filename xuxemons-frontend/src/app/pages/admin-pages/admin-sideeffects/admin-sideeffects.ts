import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { SideEffect } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';

@Component({
  selector: 'app-admin-sideeffects',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-sideeffects.html',
  styleUrl: './admin-sideeffects.css',
})
export class AdminSideeffects implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly sideEffects = signal<SideEffect[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());

  ngOnInit(): void {
    this.loadSideEffects();
  }

  private loadSideEffects(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getAllSideEffects()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          const data = res?.data;
          const list = Array.isArray(data) ? [...data].sort((a, b) => a.id - b.id) : [];
          this.sideEffects.set(list);
          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading side effects');
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load side effects');
        },
      });
  }
}
