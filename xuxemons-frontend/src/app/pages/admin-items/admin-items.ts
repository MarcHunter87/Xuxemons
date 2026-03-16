import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin';
import { AuthService } from '../../core/services/auth';
import { Item } from '../../core/interfaces';

@Component({
  selector: 'app-admin-items',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-items.html',
  styleUrl: './admin-items.css',
})
export class AdminItems implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly items = signal<Item[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());

  ngOnInit(): void {
    this.loadItems();
  }

  private loadItems(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .getAllItems()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          const data = res?.data;
          this.items.set(Array.isArray(data) ? data : []);
          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading items');
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load items');
        },
      });
  }

  getIconUrl(iconPath: string): string {
    const path = iconPath.startsWith('/') ? iconPath : `/${iconPath}`;
    return this.auth.getAssetUrl(path);
  }

  onDeleteItem(item: Item): void {
    if (!confirm(`Delete item "${item.name}"? This action cannot be undone.`)) return;
    this.adminService.deleteItem(item.id).subscribe({
      next: () => {
        this.items.set(this.items().filter((i) => i.id !== item.id));
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Failed to delete item');
      },
    });
  }
}
