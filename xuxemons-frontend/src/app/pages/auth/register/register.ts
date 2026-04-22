import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class Register implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  showPassword = false;
  showConfirmPassword = false;
  idSuffix = '';

  // Sirve para inicializar el formulario de registro e inyectar dependencias
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      surname: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    }, { validators: this.passwordMatchValidator });
  }

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.idSuffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  // Sirve para validar la contraseña
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (!password || !confirmPassword) return null;
    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  // Sirve para alternar la visibilidad de la contraseña
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // Sirve para alternar la visibilidad de la contraseña de confirmación
  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Sirve para verificar si un campo es inválido
  isFieldInvalid(fieldName: string): boolean {
    const control = this.registerForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  // Sirve para obtener el preview del ID
  get idPreview(): string {
    const name = this.registerForm.get('name')?.value ?? '';
    const nom = String(name).replace(/\s+/g, '');
    return nom ? `#${nom}${this.idSuffix}` : `#${this.idSuffix}`;
  }

  // Sirve para generar el ID
  getGeneratedId(): string {
    const name = this.registerForm.get('name')?.value ?? '';
    const nom = String(name).replace(/\s+/g, '') || 'User';
    return `#${nom}${this.idSuffix}`;
  }

  // Sirve para obtener el error de registro
  private getRegisterError(err: { error?: { message?: string; errors?: Record<string, string[]> } }): string {
    const msg = (Object.values(err?.error?.errors ?? {}) as string[][]).flat()[0];
    return msg ?? err?.error?.message ?? 'Registration failed. Please try again.';
  }

  // Sirve para obtener el mensaje de error de un campo
  getErrorMessage(fieldName: string): string {
    const control = this.registerForm.get(fieldName);
    if (!control || !control.errors || !control.touched) return '';
    const errors = control.errors;
    if (errors['required']) return 'This field is required';
    if (errors['requiredTrue']) return 'You must accept the terms and privacy policy';
    if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters`;
    if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters`;
    if (errors['email']) return 'Invalid email format';
    return 'Unknown error';
  }

  // Sirve para enviar el formulario de registro
  onSubmit(): void {
    if (this.isLoading) return;
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;

    // Sirve para registrar el usuario
    this.authService.register({
      id: this.getGeneratedId(),
      name: this.registerForm.get('name')!.value,
      surname: this.registerForm.get('surname')!.value,
      email: this.registerForm.get('email')!.value,
      password: this.registerForm.get('password')!.value,
      password_confirmation: this.registerForm.get('confirmPassword')!.value,
    }).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }),
    ).subscribe({
      error: (err) => { this.errorMessage = this.getRegisterError(err); },
    });
  }
}
