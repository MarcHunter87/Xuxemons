import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AdminDropdownOption } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-edit-xuxemon',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-edit-xuxemon.html',
  styleUrl: './admin-edit-xuxemon.css',
})
export class AdminEditXuxemon implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
  readonly isLoadingXuxemon = signal(true);
  readonly xuxemonId = signal<number | null>(null);

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

  readonly canSubmit = computed(() =>
    !this.isSaving() && !this.isLoadingMeta() && !this.isLoadingXuxemon() && this.form.valid
  );

  readonly attack2Options = computed(() =>
    this.attacks().filter((a) => !['Power Attack', 'Speed Attack', 'Technical Attack'].includes(a.name))
  );

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.form.controls.name.valueChanges.subscribe(() => this.refreshIconPathPreview());
    this.form.controls.type_id.valueChanges.subscribe(() => this.updateAttack1ForSelectedType());

    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!Number.isFinite(id)) {
      this.errorMessage.set('Invalid Xuxemon ID.');
      this.isLoadingXuxemon.set(false);
      return;
    }
    this.xuxemonId.set(id);
    this.isLoadingMeta.set(true);
    this.isLoadingXuxemon.set(true);
    this.errorMessage.set(null);
    // Sirve para cargar los metadatos de creación
    this.adminService.getCreationMeta().pipe(
      finalize(() => this.isLoadingMeta.set(false)),
      switchMap((metaRes) => {
        this.types.set(metaRes?.data?.types ?? []);
        this.attacks.set(metaRes?.data?.attacks ?? []);
        return this.adminService.getXuxemon(id);
      }),
      finalize(() => this.isLoadingXuxemon.set(false)),
    ).subscribe({
      next: (res) => {
        const x = res?.data;
        if (!x) {
          this.errorMessage.set('Xuxemon not found.');
          return;
        }
        this.patchFormWithXuxemon(x);
      },
      error: (err) => {
        if (this.errorMessage()) return;
        this.errorMessage.set(err?.error?.message ?? 'Could not load Xuxemon.');
      },
    });
  }

  // Sirve para actualizar el formulario con los datos del Xuxemon
  private patchFormWithXuxemon(x: {
    name: string;
    description?: string | null;
    type_id: number;
    attack_1_id: number;
    attack_2_id: number;
    hp: number;
    attack: number;
    defense: number;
    icon_path: string;
    updated_at?: string;
    attack1?: { name: string } | null;
  }): void {
    this.form.patchValue({
      name: x.name,
      description: x.description ?? '',
      type_id: x.type_id,
      attack_1_id: x.attack_1_id,
      attack_2_id: x.attack_2_id,
      hp: x.hp ?? 1,
      attack: x.attack ?? 1,
      defense: x.defense ?? 1,
      icon_path: x.icon_path ?? this.iconPathPreview(),
    }, { emitEvent: false });
    this.attack1Label.set(x.attack1?.name ?? 'Select type first');
    this.iconPathPreview.set(x.icon_path ?? 'xuxemons/new_xuxemon.webp');
    const url = x.icon_path
      ? this.auth.getAssetUrl(
          x.icon_path.startsWith('/') ? x.icon_path : `/${x.icon_path}`,
          x.updated_at
        )
      : null;
    this.imagePreview.set(url);
  }

  // Sirve para manejar la selección de imagen
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

  // Sirve para enviar el formulario
  submit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.xuxemonId();
    if (id == null) {
      this.errorMessage.set('Invalid Xuxemon.');
      return;
    }

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

    // Sirve para crear el formulario de datos
    const formData = new FormData();
    formData.append('name', (raw.name ?? '').trim());
    formData.append('description', (raw.description ?? '').trim());
    formData.append('type_id', String(raw.type_id));
    formData.append('attack_1_id', String(raw.attack_1_id));
    formData.append('attack_2_id', String(raw.attack_2_id));
    formData.append('hp', String(raw.hp ?? 1));
    formData.append('attack', String(raw.attack ?? 1));
    formData.append('defense', String(raw.defense ?? 1));
    const image = this.selectedImage();
    if (image) {
      const fileName = this.buildFileName(raw.name ?? 'new_xuxemon', image.name);
      formData.append('icon', image, fileName);
    }

    this.isSaving.set(true);
    this.adminService.updateXuxemon(id, formData)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Xuxemon updated successfully.');
          this.router.navigateByUrl('/admin/xuxemons');
        },
        error: (err) => {
          const errors = err?.error?.errors as Record<string, string[]> | undefined;
          this.errorMessage.set(
            this.getFirstBackendError(errors, ['name', 'type_id', 'attack_1_id', 'attack_2_id', 'hp', 'attack', 'defense', 'icon'])
            ?? err?.error?.message
            ?? 'Could not update Xuxemon.'
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

  // Sirve para actualizar la ruta del icono de previsualización
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

  // Sirve para obtener el primer error del backend
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
