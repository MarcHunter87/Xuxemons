import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { DailyReward } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';

@Component({
  selector: 'app-admin-edit-dailyreward',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-edit-dailyreward.html',
  styleUrl: './admin-edit-dailyreward.css',
})
export class AdminDailyrewardEdit implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoadingReward = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly rewardId = signal<number | null>(null);
  readonly rewardItemId = signal<number | null>(null);
  readonly rewardItemName = signal<string | null>(null);

  readonly form = this.fb.group({
    time: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
  });

  // Sirve para inicializar el componente
  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!Number.isFinite(id)) {
      this.errorMessage.set('Invalid daily reward ID.');
      this.isLoadingReward.set(false);
      return;
    }
    this.rewardId.set(id);
    this.isLoadingReward.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getDailyReward(id)
      .pipe(finalize(() => this.isLoadingReward.set(false)))
      .subscribe({
        next: (res) => {
          const reward = res?.data;
          if (!reward) {
            this.errorMessage.set('Daily reward not found.');
            return;
          }
          this.patchForm(reward);
        },
        error: (err) => {
          if (this.errorMessage()) return;
          this.errorMessage.set(err?.error?.message ?? 'Could not load daily reward.');
        },
      });
  }

  // Sirve para actualizar el formulario con los datos de la recompensa
  private patchForm(reward: DailyReward): void {
    this.rewardItemId.set(reward.item_id);
    this.rewardItemName.set(reward.item_name ?? null);
    this.form.patchValue(
      {
        time: this.toInputTime(reward.time),
        quantity: reward.quantity ?? 1,
      },
      { emitEvent: false },
    );
  }

  // Sirve para convertir el tiempo a formato de entrada
  private toInputTime(rawTime: string): string {
    if (!rawTime) return '';
    const parts = rawTime.split(':');
    if (parts.length < 2) return rawTime;
    return `${parts[0]}:${parts[1]}`;
  }

  // Sirve para verificar si un campo es inválido
  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  // Sirve para obtener el mensaje de error de un campo
  getErrorMessage(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }
    const errors = control.errors;
    if (errors['required']) return 'This field is required.';
    if (errors['min']) return `Minimum value is ${errors['min'].min}.`;
    if (errors['pattern']) return 'Only numbers are allowed.';
    return 'Invalid value.';
  }

  // Sirve para enviar el formulario
  submit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.rewardId();
    if (id == null) {
      this.errorMessage.set('Invalid daily reward.');
      return;
    }

    const raw = this.form.value;
    const payload = {
      time: raw.time || '',
      quantity: Number(raw.quantity) || 1,
    };

    this.isSaving.set(true);
    this.adminService
      .updateDailyReward(id, payload)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Daily reward updated successfully.');
          this.router.navigateByUrl('/admin/daily-rewards');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? "Couldn't update daily reward.");
        },
      });
  }

  // Sirve para volver a la página de recompensas diarias
  goBack(): void {
    this.router.navigateByUrl('/admin/daily-rewards');
  }
}
