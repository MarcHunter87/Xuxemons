import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin';

@Component({
  selector: 'app-admin-edit-evolve',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-edit-evolve.html',
  styleUrl: './admin-edit-evolve.css',
})
export class AdminEditEvolve implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoadingSize = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly sizeId = signal<number | null>(null);
  readonly size = signal<string>('');
  readonly notEditable = signal(false);

  readonly form = this.fb.group({
    requirement_progress: [0, [Validators.required, Validators.pattern(/^\d+$/), Validators.min(0)]],
  });

  // Sirve para inicializar el componente
  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!Number.isFinite(id)) {
      this.errorMessage.set('Invalid Size ID.');
      this.isLoadingSize.set(false);
      return;
    }
    this.sizeId.set(id);
    this.isLoadingSize.set(true);
    this.errorMessage.set(null);

    this.adminService.getSize(id)
      .pipe(finalize(() => this.isLoadingSize.set(false)))
      .subscribe({
        next: (res) => {
          const size = res?.data;
          if (!size) {
            this.errorMessage.set('Size not found.');
            return;
          }
          this.size.set(size.size ?? '');
          if (size.size === 'Small') {
            this.notEditable.set(true);
            this.errorMessage.set('Small size cannot be edited.');
            return;
          }
          this.form.patchValue({
            requirement_progress: size.requirement_progress ?? 0,
          }, { emitEvent: false });
        },
        error: (err) => {
          if (this.errorMessage()) return;
          this.errorMessage.set(err?.error?.message ?? 'Could not load size.');
        },
      });
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

    if (this.notEditable()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.sizeId();
    if (id == null) {
      this.errorMessage.set('Invalid size.');
      return;
    }

    const raw = this.form.value;
    const data = {
      requirement_progress: Number(raw.requirement_progress) || 0,
    };

    this.isSaving.set(true);
    this.adminService.updateSize(id, data)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Evolution requirement updated successfully.');
          this.router.navigateByUrl('/admin/evolve');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? "Couldn't update size.");
        },
      });
  }

  // Sirve para volver a la página de evoluciones
  goBack(): void {
    this.router.navigateByUrl('/admin/evolve');
  }
}
