import { ChangeDetectorRef, Component, signal, ElementRef, ViewChild, HostListener, AfterViewChecked } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DeleteAccountModal } from '../../core/components/modals/delete-account-modal/delete-account-modal';
import { AuthService, User } from '../../core/services/auth';

@Component({
  selector: 'app-edit-profile',
  imports: [ReactiveFormsModule, DeleteAccountModal],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
})
export class EditProfile {
  @ViewChild('bannerInput') bannerInput!: ElementRef<HTMLInputElement>;
  @ViewChild('iconInput') iconInput!: ElementRef<HTMLInputElement>;
  @ViewChild('deleteDialog') deleteDialog?: ElementRef<HTMLElement>;
  @ViewChild('primaryDeactivateButton') primaryDeactivateButton?: ElementRef<HTMLButtonElement>;

  user: User | null = null;
  bannerPreview = signal<string>('/images/default_banner.png');
  iconPreview = signal<string | null>(null);
  isUploadingBanner = signal(false);
  isUploadingIcon = signal(false);
  uploadError = signal('');
  personalInfoError = signal('');
  personalInfoSuccess = signal('');
  passwordError = signal('');
  passwordSuccess = signal('');
  deactivateError = signal('');
  isDeactivating = signal(false);
  showDeactivateModal = signal(false);
  isSavingPersonalInfo = signal(false);
  isSavingPassword = signal(false);
  showPassword: Record<'current_password' | 'new_password' | 'confirm_password', boolean> = {
    current_password: false,
    new_password: false,
    confirm_password: false,
  };
  personalInfoForm: FormGroup;
  passwordForm: FormGroup;
  settingsForm: FormGroup;
  settingsError = signal('');
  settingsSuccess = signal('');
  isSavingSettings = signal(false);

  private previousFocusedElement: HTMLElement | null = null;
  private shouldFocusRoot = false;
  private shouldFocusPrimaryAction = false;

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
    
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.settingsForm = this.fb.group({
      view_animations: [!prefersReducedMotion],
      theme: ['light'],
    });

    this.user = this.authService.getUser();

    this.personalInfoForm.patchValue({
      name: this.user?.name ?? '',
      surname: this.user?.surname ?? '',
      email: this.user?.email ?? '',
    });

    this.settingsForm.patchValue({
      view_animations: this.user?.view_animations ?? !prefersReducedMotion,
      theme: this.user?.theme ?? 'light',
    });

    if (this.user?.banner_path) {
      this.bannerPreview.set(this.authService.getAssetUrl(this.user.banner_path, this.user.updated_at));
    }
    if (this.user?.icon_path) {
      this.iconPreview.set(this.authService.getAssetUrl(this.user.icon_path, this.user.updated_at));
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocusRoot && this.deleteDialog?.nativeElement) {
      this.deleteDialog.nativeElement.focus();
      this.shouldFocusRoot = false;
    }
    if (this.shouldFocusPrimaryAction && this.primaryDeactivateButton?.nativeElement) {
      this.primaryDeactivateButton.nativeElement.focus();
      this.shouldFocusPrimaryAction = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeModal(): void {
    if (this.showDeactivateModal()) this.closeDeactivateModal();
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (!this.showDeactivateModal() || event.key !== 'Tab') return;
    const root = this.deleteDialog?.nativeElement;
    if (!root) return;

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusable = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);

    if (focusable.length === 0) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); return; }
    if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  updatePersonalInformation(): void {
    this.personalInfoError.set('');
    this.personalInfoSuccess.set('');

    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      this.personalInfoError.set('Please complete all fields correctly.');
      return;
    }

    this.isSavingPersonalInfo.set(true);
    const { name, surname, email } = this.personalInfoForm.getRawValue();

    this.authService.updatePersonalInfo({
      name: (name ?? '').trim(),
      surname: (surname ?? '').trim(),
      email: (email ?? '').trim(),
    }).subscribe({
      next: ({ message, user }) => {
        this.isSavingPersonalInfo.set(false);
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
        this.isSavingPersonalInfo.set(false);
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

  updateSettings(): void {
    this.settingsError.set('');
    this.settingsSuccess.set('');
    this.isSavingSettings.set(true);

    const { view_animations, theme } = this.settingsForm.getRawValue();

    this.authService.updatePersonalInfo({
      view_animations: !!view_animations,
      theme: theme || 'light',
    }).subscribe({
      next: ({ user }) => {
        this.isSavingSettings.set(false);
        this.user = user;
        this.settingsSuccess.set('Settings updated successfully.');
        this.cdr.detectChanges();
        // Clear success message after 3 seconds
        setTimeout(() => this.settingsSuccess.set(''), 3000);
      },
      error: err => {
        this.isSavingSettings.set(false);
        this.settingsError.set(err?.error?.message || 'Could not update settings.');
        this.cdr.detectChanges();
      }
    });
  }

  onViewAnimationsToggle(): void {
    if (this.isSavingSettings()) return;
    this.updateSettings();
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
      this.passwordError.set('');
      return;
    }

    this.isSavingPassword.set(true);
    this.authService.updatePassword({
      current_password: (current_password ?? '').trim(),
      new_password: (new_password ?? '').trim(),
    }).subscribe({
      next: ({ message }) => {
        this.isSavingPassword.set(false);
        this.passwordSuccess.set(message || 'Password updated successfully.');
        this.resetPasswordForm(false);
        this.cdr.detectChanges();
      },
      error: err => {
        this.isSavingPassword.set(false);
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
    // Perform delete action (called from modal confirm)
    this.deactivateError.set('');
    this.isDeactivating.set(true);

    this.authService.deactivateAccount().subscribe({
      next: () => {
        this.isDeactivating.set(false);
        this.closeDeactivateModal();
        this.cdr.detectChanges();
      },
      error: err => {
        const backendErrors = err?.error?.errors as Record<string, string[]> | undefined;
        this.deactivateError.set(
          backendErrors?.['server']?.[0]
          ?? err?.error?.message
          ?? 'Couldn\'t delete account.'
        );
        this.isDeactivating.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  openDeactivateModal(): void {
    this.deactivateError.set('');
    this.previousFocusedElement = typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null;
    this.shouldFocusRoot = true;
    this.shouldFocusPrimaryAction = true;
    this.showDeactivateModal.set(true);
  }

  closeDeactivateModal(): void {
    this.showDeactivateModal.set(false);
    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      setTimeout(() => this.previousFocusedElement?.focus(), 0);
    }
  }

  openBannerPicker(): void {
    this.bannerInput.nativeElement.click();
  }

  openIconPicker(): void {
    this.iconInput.nativeElement.click();
  }

  onBannerSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file?.type.startsWith('image/')) {
      this.uploadImage(file, 'banner', 15 * 1024 * 1024, 'Banner image must be less than 15MB.');
    } else if (file) {
      this.uploadError.set('Please select a valid image file.');
    }
  }

  onIconSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file?.type.startsWith('image/')) {
      this.uploadImage(file, 'icon', 10 * 1024 * 1024, 'Icon image must be less than 10MB.');
    } else if (file) {
      this.uploadError.set('Please select a valid image file.');
    }
  }

  private uploadImage(file: File, type: 'banner' | 'icon', maxBytes: number, sizeError: string): void {
    if (file.size > maxBytes) {
      this.uploadError.set(sizeError);
      return;
    }
    this.uploadError.set('');
    const preview = type === 'banner' ? this.bannerPreview : this.iconPreview;
    const setUploading = (v: boolean) => (type === 'banner' ? this.isUploadingBanner : this.isUploadingIcon).set(v);

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      preview.set(reader.result as string);
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);

    const req = type === 'banner' ? this.authService.uploadBanner(file) : this.authService.uploadIcon(file);
    req.subscribe({
      next: () => {
        this.user = this.authService.getUser();
        const path = type === 'banner' ? this.user?.banner_path : this.user?.icon_path;
        if (path && this.user?.updated_at) {
          preview.set(this.authService.getAssetUrl(path, this.user.updated_at));
        }
        setUploading(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const errors = err?.error?.errors as Record<string, string[]> | undefined;
        const msg = errors?.[type]?.[0] ?? Object.values(errors ?? {})[0]?.[0] ?? err?.error?.message ?? `Could not upload ${type}.`;
        this.uploadError.set(msg);
        setUploading(false);
        this.cdr.detectChanges();
      },
    });
  }
}
