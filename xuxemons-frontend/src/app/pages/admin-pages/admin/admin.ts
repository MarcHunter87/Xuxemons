import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';
import { AdminUser, BagStatus } from '../../../core/interfaces';

export interface AwardedXuxemonDisplay {
  id: number;
  name: string;
  type: { name: string };
  image_url: string;
  hp: number;
  attack: number;
  defense: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly users = signal<AdminUser[]>([]);
  readonly bagStatusMap = signal<Record<string, BagStatus>>({});
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly showAwardModal = signal(false);
  readonly awardedXuxemon = signal<AwardedXuxemonDisplay | null>(null);
  readonly awardLoadingUserId = signal<string | null>(null);
  readonly banLoadingUserId = signal<string | null>(null);
  readonly awardError = signal<string | null>(null);

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

  giveRandomXuxemon(user: AdminUser): void {
    this.awardError.set(null);
    this.awardLoadingUserId.set(user.id);
    this.adminService.awardRandomXuxemonToUser(user.id).pipe(
      finalize(() => this.awardLoadingUserId.set(null))
    ).subscribe({
      next: (raw) => {
        const image_url = raw?.icon_path ? this.auth.getAssetUrl(`/${raw.icon_path}`) : '';
        this.awardedXuxemon.set({
          id: raw?.id,
          name: raw?.name ?? '',
          type: raw?.type ?? { name: '' },
          image_url,
          hp: raw?.hp ?? 0,
          attack: raw?.attack ?? 0,
          defense: raw?.defense ?? 0,
        });
        this.showAwardModal.set(true);
      },
      error: (err) => {
        this.awardError.set(err?.error?.message ?? 'Failed to award random Xuxemon');
      },
    });
  }

  banUser(user: AdminUser): void {
    const confirmed = window.confirm(`Are you sure you want to ban ${this.getUserFullName(user)}?`);
    if (!confirmed) {
      return;
    }

    this.errorMessage.set(null);
    this.banLoadingUserId.set(user.id);
    this.adminService
      .banUser(user.id)
      .pipe(finalize(() => this.banLoadingUserId.set(null)))
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
          this.bagStatusMap.update((map) => {
            const next = { ...map };
            delete next[user.id];
            return next;
          });
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to ban user');
        },
      });
  }

  closeAwardModal(): void {
    this.showAwardModal.set(false);
    this.awardedXuxemon.set(null);
    this.awardError.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showAwardModal()) {
      this.closeAwardModal();
      return;
    }
    if (this.awardError()) this.dismissAwardError();
  }

  dismissAwardError(): void {
    this.awardError.set(null);
  }

  getTypeColor(typeName: string): string {
    switch (typeName) {
      case 'Power': return '#D0181B';
      case 'Speed': return '#0D6EFD';
      case 'Technical': return '#28A745';
      default: return '#777';
    }
  }
}
