import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';

export interface XuxemonRow {
  id: number;
  name: string;
  description: string | null;
  type: { name: string } | null;
  image_url: string;
  updated_at?: string;
  attack1_name: string;
  attack2_name: string;
  hp: number;
  attack: number;
  defense: number;
}

@Component({
  selector: 'app-admin-xuxemons',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-xuxemons.html',
  styleUrl: './admin-xuxemons.css',
})
export class AdminXuxemons implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly xuxemons = signal<XuxemonRow[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly hasContent = computed(() => !this.isLoading() && !this.errorMessage());

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.loadXuxemons();
  }

  // Sirve para cargar los Xuxemons
  private loadXuxemons(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .getAllXuxemons()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (raw) => {
          const list = Array.isArray(raw) ? raw : [];
          const rows: XuxemonRow[] = list.map((x) => ({
            id: x.id,
            name: x.name ?? '',
            description: x.description ?? null,
            type: x.type ?? null,
            image_url: this.auth.getAssetUrl(`/${x.icon_path || ''}`, x.updated_at),
            updated_at: x.updated_at ?? undefined,
            attack1_name: x.attack1?.name ?? '—',
            attack2_name: x.attack2?.name ?? '—',
            hp: x.hp ?? 0,
            attack: x.attack ?? 0,
            defense: x.defense ?? 0,
          }));
          this.xuxemons.set(rows);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load Xuxemons');
        },
      });
  }

  // Sirve para obtener el color del tipo de Xuxemon
  getTypeColor(typeName: string): string {
    switch (typeName) {
      case 'Power': return 'var(--color-red-base)';
      case 'Speed': return 'var(--accent-color)';
      case 'Technical': return 'var(--color-green-base)';
      default: return 'var(--color-gray-medium)';
    }
  }

  // Sirve para eliminar un Xuxemon
  onDeleteXuxemon(row: XuxemonRow): void {
    if (!confirm(`Delete Xuxemon "${row.name}"? This action cannot be undone.`)) return;
    this.adminService.deleteXuxemon(row.id).subscribe({
      next: () => {
        this.xuxemons.set(this.xuxemons().filter((x) => x.id !== row.id));
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Failed to delete Xuxemon');
      },
    });
  }
}
