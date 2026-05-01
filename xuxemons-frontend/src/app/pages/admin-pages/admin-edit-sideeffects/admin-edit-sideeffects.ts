import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { SideEffect } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';

@Component({
  selector: 'app-admin-edit-sideeffects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-edit-sideeffects.html',
  styleUrl: './admin-edit-sideeffects.css',
})
export class AdminEditSideeffects implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoadingSideEffect = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly sideEffectId = signal<number | null>(null);
  readonly sideEffectName = signal<string>('');
  readonly sideEffectDescription = signal<string | null>(null);

  readonly form = this.fb.group({
    apply_chance: ['', [Validators.pattern(/^\d+$/), Validators.min(0), Validators.max(100)]],
  });

  // Sirve para inicializar el componente
  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!Number.isFinite(id)) {
      this.errorMessage.set('Invalid side effect ID.');
      this.isLoadingSideEffect.set(false);
      return;
    }
    this.sideEffectId.set(id);
    this.isLoadingSideEffect.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getSideEffect(id)
      .pipe(finalize(() => this.isLoadingSideEffect.set(false)))
      .subscribe({
        next: (res) => {
          const sideEffect = res?.data;
          if (!sideEffect) {
            this.errorMessage.set('Side effect not found.');
            return;
          }
          this.patchForm(sideEffect);
        },
        error: (err) => {
          if (this.errorMessage()) return;
          this.errorMessage.set(err?.error?.message ?? 'Could not load side effect.');
        },
      });
  }

  // Sirve para actualizar el formulario con los datos del efecto secundario
  private patchForm(sideEffect: SideEffect): void {
    this.sideEffectName.set(sideEffect.name);
    this.sideEffectDescription.set(sideEffect.description ?? null);
    this.form.patchValue(
      {
        apply_chance: sideEffect.apply_chance !== null ? String(sideEffect.apply_chance) : '',
      },
      { emitEvent: false },
    );
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
    if (errors['pattern']) return 'Only numbers are allowed.';
    if (errors['min']) return 'Minimum value is 0.';
    if (errors['max']) return 'Maximum value is 100.';
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

    const id = this.sideEffectId();
    if (id == null) {
      this.errorMessage.set('Invalid side effect.');
      return;
    }

    const applyChanceRaw = this.form.value.apply_chance;
    const payload = {
      apply_chance: applyChanceRaw === null || applyChanceRaw === undefined || applyChanceRaw === ''
        ? null
        : Number(applyChanceRaw),
    };

    this.isSaving.set(true);
    // Sirve para actualizar el efecto secundario
    this.adminService
      .updateSideEffect(id, payload)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Side effect updated successfully.');
          this.router.navigateByUrl('/admin/side-effects');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? "Couldn't update side effect.");
        },
      });
  }

  // Sirve para volver a la página de efectos secundarios
  goBack(): void {
    this.router.navigateByUrl('/admin/side-effects');
  }

}
