import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminDropdownOption } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-new-xuxemon',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-new-xuxemon.html',
  styleUrl: './admin-new-xuxemon.css',
})
export class AdminNewXuxemon implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly types = signal<AdminDropdownOption[]>([]);
  readonly attacks = signal<AdminDropdownOption[]>([]);
  readonly isLoadingMeta = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly selectedImage = signal<File | null>(null);
  readonly iconPathPreview = signal('xuxemons/new_xuxemon.webp');
  readonly attack1Label = signal('Select type first');
  readonly typeDropdownOpen = signal(false);
  readonly attack2DropdownOpen = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    description: [''],
    type_id: [null as number | null, [Validators.required]],
    attack_1_id: [null as number | null, [Validators.required]],
    attack_2_id: [null as number | null, [Validators.required]],
    hp: [1, [Validators.required, Validators.min(1)]],
    attack: [1, [Validators.required, Validators.min(1)]],
    defense: [1, [Validators.required, Validators.min(1)]],
    icon_path: [{ value: this.iconPathPreview(), disabled: true }],
  });

  readonly attack2Options = computed(() =>
    this.attacks().filter((a) => !['Power Attack', 'Speed Attack', 'Technical Attack'].includes(a.name))
  );

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.loadMetadata();
    this.form.controls.name.valueChanges.subscribe(() => this.refreshIconPathPreview());
    this.form.controls.type_id.valueChanges.subscribe(() => this.updateAttack1ForSelectedType());
  }

  // Sirve para cargar los metadatos
  private loadMetadata(): void {
    this.isLoadingMeta.set(true);
    this.errorMessage.set(null);
    this.adminService.getCreationMeta()
      .pipe(finalize(() => this.isLoadingMeta.set(false)))
      .subscribe({
        next: (res) => {
          this.types.set(res?.data?.types ?? []);
          this.attacks.set(res?.data?.attacks ?? []);
          this.updateAttack1ForSelectedType();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Could not load form metadata.');
        },
      });
  }

  // Sirve para seleccionar una imagen
  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Please select a valid image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.errorMessage.set('Image must be less than 20MB.');
      return;
    }

    this.errorMessage.set(null);
    this.selectedImage.set(file);
    this.refreshIconPathPreview();
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set((reader.result as string) || null);
    reader.readAsDataURL(file);
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
    if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters.`;
    if (errors['min']) return `Minimum value is ${errors['min'].min}.`;
    if (errors['mismatch']) return 'Attack 1 and Attack 2 must be different.';
    return 'Invalid value.';
  }

  // Sirve para enviar el formulario de creación de Xuxemon
  submit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Sirve para seleccionar una imagen
    const image = this.selectedImage();
    if (!image) {
      this.errorMessage.set('Please choose an image for the Xuxemon.');
      return;
    }

    // Sirve para obtener los valores del formulario
    const raw = this.form.getRawValue();
    const attack2Control = this.form.get('attack_2_id');
    if (attack2Control?.hasError('mismatch')) {
      const { mismatch, ...rest } = attack2Control.errors ?? {};
      attack2Control.setErrors(Object.keys(rest).length ? rest : null);
    }
    if (raw.attack_1_id === raw.attack_2_id) {
      attack2Control?.setErrors({ ...(attack2Control?.errors ?? {}), mismatch: true });
      attack2Control?.markAsTouched();
      return;
    }

    const fileName = this.buildFileName(raw.name ?? 'new_xuxemon', image.name);
    const formData = new FormData();
    formData.append('name', (raw.name ?? '').trim());
    formData.append('description', (raw.description ?? '').trim());
    formData.append('type_id', String(raw.type_id));
    formData.append('attack_1_id', String(raw.attack_1_id));
    formData.append('attack_2_id', String(raw.attack_2_id));
    formData.append('hp', String(raw.hp ?? 1));
    formData.append('attack', String(raw.attack ?? 1));
    formData.append('defense', String(raw.defense ?? 1));
    formData.append('icon', image, fileName);

    this.isSaving.set(true);
    // Sirve para crear el Xuxemon
    this.adminService.createXuxemon(formData)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Xuxemon created successfully.');
          this.router.navigateByUrl('/admin/xuxemons');
        },
        error: (err) => {
          const errors = err?.error?.errors as Record<string, string[]> | undefined;
          this.errorMessage.set(
            this.getFirstBackendError(errors, ['name', 'type_id', 'attack_1_id', 'attack_2_id', 'hp', 'attack', 'defense', 'icon'])
            ?? err?.error?.message
            ?? 'Could not create Xuxemon.'
          );
        },
      });
  }

  // Sirve para volver a la página de Xuxemons
  goBack(): void {
    this.router.navigateByUrl('/admin/xuxemons');
  }

  // Sirve para obtener el tipo seleccionado
  getSelectedType(): AdminDropdownOption | undefined {
    const id = this.form.controls.type_id.value;
    if (id == null) return undefined;
    return this.types().find((t) => t.id === id);
  }

  // Sirve para obtener la URL del icono del tipo
  getTypeIconUrl(iconPath: string | undefined): string {
    if (!iconPath) return '';
    const path = iconPath.startsWith('/') ? iconPath : `/${iconPath}`;
    return this.auth.getAssetUrl(path);
  }

  // Sirve para seleccionar un tipo
  selectType(type: AdminDropdownOption | null): void {
    this.form.controls.type_id.setValue(type?.id ?? null);
    this.form.controls.type_id.markAsTouched();
    this.typeDropdownOpen.set(false);
    this.updateAttack1ForSelectedType();
  }

  // Sirve para cerrar el dropdown de tipos
  closeTypeDropdown(): void {
    this.typeDropdownOpen.set(false);
  }

  // Sirve para manejar el focus out del dropdown de tipos
  onTypeFocusOut(event: FocusEvent): void {
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || (next && wrapper.contains(next))) return;
    this.closeTypeDropdown();
  }

  // Sirve para obtener el ataque 2 seleccionado
  getSelectedAttack2(): AdminDropdownOption | undefined {
    const id = this.form.controls.attack_2_id.value;
    if (id == null) return undefined;
    return this.attacks().find((a) => a.id === id);
  }

  // Sirve para seleccionar un ataque 2
  selectAttack2(attack: AdminDropdownOption | null): void {
    this.form.controls.attack_2_id.setValue(attack?.id ?? null);
    this.form.controls.attack_2_id.markAsTouched();
    this.attack2DropdownOpen.set(false);
  }

  // Sirve para cerrar el dropdown de ataques 2
  closeAttack2Dropdown(): void {
    this.attack2DropdownOpen.set(false);
  }

  // Sirve para manejar el focus out del dropdown de ataques 2
  onAttack2FocusOut(event: FocusEvent): void {
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || (next && wrapper.contains(next))) return;
    this.closeAttack2Dropdown();
  }

  // Sirve para manejar el escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.typeDropdownOpen()) this.closeTypeDropdown();
    if (this.attack2DropdownOpen()) this.closeAttack2Dropdown();
  }

  // Sirve para actualizar el preview del icono
  private refreshIconPathPreview(): void {
    const name = this.form.controls.name.value ?? 'new_xuxemon';
    const currentImage = this.selectedImage();
    const fileName = this.buildFileName(name, currentImage?.name);
    this.iconPathPreview.set(`xuxemons/${fileName}`);
    this.form.controls.icon_path.setValue(this.iconPathPreview(), { emitEvent: false });
  }

  // Sirve para actualizar el ataque 1 para el tipo seleccionado
  private updateAttack1ForSelectedType(): void {
    const typeId = this.form.controls.type_id.value;
    const selectedType = this.types().find((type) => type.id === Number(typeId));
    const baseAttackName = this.getBaseAttackNameForType(selectedType?.name ?? '');
    const baseAttack = this.attacks().find((attack) => attack.name === baseAttackName);

    if (baseAttack) {
      this.form.controls.attack_1_id.setValue(baseAttack.id, { emitEvent: false });
      this.attack1Label.set(baseAttack.name);
      return;
    }

    this.form.controls.attack_1_id.setValue(null, { emitEvent: false });
    this.attack1Label.set(selectedType ? 'No base attack found for this type' : 'Select type first');
  }

  // Sirve para obtener el nombre del ataque base para el tipo
  private getBaseAttackNameForType(typeName: string): string {
    switch ((typeName || '').trim().toLowerCase()) {
      case 'power':
        return 'Power Attack';
      case 'speed':
        return 'Speed Attack';
      case 'technical':
        return 'Technical Attack';
      default:
        return '';
    }
  }

  // Sirve para construir el nombre del archivo
  private buildFileName(rawName: string, originalName?: string): string {
    const safeBase = (rawName || 'new_xuxemon')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'new_xuxemon';
    return `${safeBase}.webp`;
  }

  // Sirve para obtener el primer error de backend
  private getFirstBackendError(
    errors: Record<string, string[]> | undefined,
    preferredKeys: string[],
  ): string | undefined {
    if (!errors) return undefined;
    for (const key of preferredKeys) {
      const msg = errors[key]?.[0];
      if (msg) return msg;
    }
    const fallback = Object.values(errors).flat()[0];
    return fallback;
  }
}
