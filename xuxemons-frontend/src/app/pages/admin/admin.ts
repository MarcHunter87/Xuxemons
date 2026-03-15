import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin';
import { AdminUser, BagStatus } from '../../core/interfaces';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly users = signal<AdminUser[]>([]);
  readonly bagStatusMap = signal<Record<string, BagStatus>>({});
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());

  ngOnInit(): void {
    this.loadAllUsers();
  }

  private loadAllUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getAllUsers()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          const data = response?.data;
          const list = Array.isArray(data) ? data : [];
          this.users.set(list);

          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading users');
            return;
          }

          list.forEach((user) => this.checkBagStatus(user.id));
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load users');
        },
      });
  }

  private checkBagStatus(userId: string): void {
    this.adminService.checkBagStatus(userId).subscribe({
      next: (response) => {
        this.bagStatusMap.update((map) => ({ ...map, [userId]: response.data }));
      },
      error: () => {},
    });
  }

  canGiveItems(userId: string): boolean {
    const status = this.bagStatusMap()[userId];
    if (!status) return false;
    return status.available_slots > 0;
  }

  getUserFullName(user: AdminUser): string {
    return `${user.name} ${user.surname}`;
  }

  getEncodedUserId(id: string): string {
    return encodeURIComponent(id);
  }
}
