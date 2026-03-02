import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth';

@Component({
  selector: 'app-edit-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
})
export class EditProfile {
  user: User | null = null;
  bannerPreview: string | null = '/images/default_banner.png';
  avatarPreview: string | null = null;
  personalInfoError = signal('');
  personalInfoSuccess = signal('');
  passwordError = signal('');
  passwordSuccess = signal('');
  deactivateError = signal('');
  isDeactivating = signal(false);
  showPassword: Record<'current_password' | 'new_password' | 'confirm_password', boolean> = {
    current_password: false,
    new_password: false,
    confirm_password: false,
  };
  personalInfoForm: FormGroup;
  passwordForm: FormGroup;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {
    this.personalInfoForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(30)]],
      surname: ['', [Validators.required, Validators.maxLength(30)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.user = this.authService.getUser();

    this.personalInfoForm.patchValue({
      name: this.user?.name ?? '',
      surname: this.user?.surname ?? '',
      email: this.user?.email ?? '',
    });
  }

  updatePersonalInformation(): void {
    this.personalInfoError.set('');
    this.personalInfoSuccess.set('');

    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      this.personalInfoError.set('Please complete all fields correctly.');
      return;
    }

    const { name, surname, email } = this.personalInfoForm.getRawValue();

    this.authService.updatePersonalInfo({
      name: (name ?? '').trim(),
      surname: (surname ?? '').trim(),
      email: (email ?? '').trim(),
    }).subscribe({
      next: ({ message, user }) => {
        this.user = user;
        this.personalInfoForm.patchValue({
          name: user.name,
          surname: user.surname,
          email: user.email,
        });
        this.personalInfoSuccess.set(message || 'Personal information updated successfully.');
        this.cdr.detectChanges();
      },
      error: err => {
        const backendErrors = err?.error?.errors as Record<string, string[]> | undefined;
        this.personalInfoError.set(
          backendErrors?.['email']?.[0]
          ?? backendErrors?.['name']?.[0]
          ?? backendErrors?.['surname']?.[0]
          ?? backendErrors?.['payload']?.[0]
          ?? err?.error?.message
          ?? 'Could not update personal information.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  updatePassword(): void {
    this.passwordError.set('');
    this.passwordSuccess.set('');

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.passwordError.set('Please complete all password fields correctly.');
      return;
    }

    const { current_password, new_password, confirm_password } = this.passwordForm.getRawValue();

    const confirmControl = this.passwordForm.get('confirm_password');
    if (confirmControl?.hasError('mismatch')) {
      const { mismatch, ...rest } = confirmControl.errors ?? {};
      confirmControl.setErrors(Object.keys(rest).length ? rest : null);
    }

    if ((new_password ?? '') !== (confirm_password ?? '')) {
      confirmControl?.setErrors({ ...(confirmControl?.errors ?? {}), mismatch: true });
      confirmControl?.markAsTouched();
      this.passwordError.set('New password and confirm password must be the same.');
      return;
    }

    this.authService.updatePassword({
      current_password: (current_password ?? '').trim(),
      new_password: (new_password ?? '').trim(),
    }).subscribe({
      next: ({ message }) => {
        this.passwordSuccess.set(message || 'Password updated successfully.');
        this.resetPasswordForm(false);
        this.cdr.detectChanges();
      },
      error: err => {
        const backendErrors = err?.error?.errors as Record<string, string[]> | undefined;
        this.passwordError.set(
          backendErrors?.['current_password']?.[0]
          ?? backendErrors?.['new_password']?.[0]
          ?? err?.error?.message
          ?? 'Could not update password.'
        );
        this.cdr.detectChanges();
      },
    });
  }

  resetPasswordForm(clearMessages: boolean = true): void {
    if (clearMessages) {
      this.passwordError.set('');
      this.passwordSuccess.set('');
    }

    this.passwordForm.reset({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });

    this.passwordForm.markAsPristine();
    this.passwordForm.markAsUntouched();

    this.showPassword.current_password = false;
    this.showPassword.new_password = false;
    this.showPassword.confirm_password = false;
  }

  togglePasswordVisibility(controlName: 'current_password' | 'new_password' | 'confirm_password'): void {
    this.showPassword[controlName] = !this.showPassword[controlName];
  }

  passwordInputType(controlName: 'current_password' | 'new_password' | 'confirm_password'): 'text' | 'password' {
    return this.showPassword[controlName] ? 'text' : 'password';
  }

  controlError(scope: 'personal' | 'password', controlName: string): string | null {
    const form = scope === 'personal' ? this.personalInfoForm : this.passwordForm;
    const control = form.get(controlName);

    if (!control || !(control.touched || control.dirty)) {
      return null;
    }

    const errors = control.errors;
    if (!errors) {
      return null;
    }

    if (errors['required']) {
      return 'This field is required.';
    }

    if (errors['email']) {
      return 'Please enter a valid email.';
    }

    if (errors['minlength']) {
      return `Minimum ${errors['minlength'].requiredLength} characters.`;
    }

    if (errors['maxlength']) {
      return `Maximum ${errors['maxlength'].requiredLength} characters.`;
    }

    if (errors['mismatch']) {
      return 'Passwords must match.';
    }

    return null;
  }

  resetFormsPersonal(): void {
    this.personalInfoError.set('');
    this.personalInfoSuccess.set('');

    this.personalInfoForm.reset({
      name: this.user?.name ?? '',
      surname: this.user?.surname ?? '',
      email: this.user?.email ?? '',
    });

    this.personalInfoForm.markAsPristine();
    this.personalInfoForm.markAsUntouched();
  }

  confirmDeactivateAccount(): void {
    this.deactivateError.set('');

    const confirmed = window.confirm('Are you sure you want to deactivate your account?');
    if (!confirmed) {
      return;
    }

    this.isDeactivating.set(true);

    this.authService.deactivateAccount().subscribe({
      next: () => {
        this.isDeactivating.set(false);
        this.cdr.detectChanges();
      },
      error: err => {
        const backendErrors = err?.error?.errors as Record<string, string[]> | undefined;
        this.deactivateError.set(
          backendErrors?.['server']?.[0]
          ?? err?.error?.message
          ?? 'Could not deactivate account.'
        );
        this.isDeactivating.set(false);
        this.cdr.detectChanges();
      },
    });
  }
}
