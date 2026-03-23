import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AdminDropdownOption, Item } from '../../../core/interfaces';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-edit-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-edit-item.html',
  styleUrl: './admin-edit-item.css',
})
export class AdminEditItem implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly effectTypes = [
    'Heal',
    'DMG Up',
    'Defense Up',
    'Gacha Ticket',
    'Remove Status Effects',
    'Apply Status Effects',
    'Evolve',
  ];

  readonly statusEffects = signal<AdminDropdownOption[]>([]);
  readonly effectTypeDropdownOpen = signal(false);
  readonly isLoadingMeta = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly selectedImage = signal<File | null>(null);
  readonly iconPathPreview = signal('items/new_item.png');
  readonly isLoadingItem = signal(true);
  readonly itemId = signal<number | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required]],
    effect_type: ['', [Validators.required]],
    effect_value: [null as number | null, [Validators.min(0), Validators.pattern(/^\d*$/)]],
    is_stackable: [false, [Validators.required]],
    max_quantity: [{ value: '1', disabled: true }, [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(5)]],
    status_effect_id: [null as number | null],
    icon_path: [{ value: this.iconPathPreview(), disabled: true }],
  });

  ngOnInit(): void {
    this.bindFormLogic();
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!Number.isFinite(id)) {
      this.errorMessage.set('Invalid item ID.');
      this.isLoadingItem.set(false);
      return;
    }
    this.itemId.set(id);
    this.isLoadingMeta.set(true);
    this.isLoadingItem.set(true);
    this.errorMessage.set(null);
    this.adminService.getCreationMeta().pipe(
      finalize(() => this.isLoadingMeta.set(false)),
      switchMap((metaRes) => {
        this.statusEffects.set(metaRes?.data?.status_effects ?? []);
        return this.adminService.getItem(id);
      }),
      finalize(() => this.isLoadingItem.set(false)),
    ).subscribe({
      next: (res) => {
        const item = res?.data;
        if (!item) {
          this.errorMessage.set('Item not found.');
          return;
        }
        this.patchFormWithItem(item);
      },
      error: (err) => {
        if (this.errorMessage()) return;
        this.errorMessage.set(err?.error?.message ?? 'Could not load item.');
      },
    });
  }

  private patchFormWithItem(item: Item): void {
    this.form.patchValue({
      name: item.name,
      description: item.description ?? '',
      effect_type: item.effect_type ?? '',
      effect_value: item.effect_value ?? null,
      is_stackable: item.is_stackable ?? false,
      max_quantity: item.is_stackable ? String(item.max_quantity ?? 1) : '1',
      status_effect_id: item.status_effect_id ?? null,
      icon_path: item.icon_path ?? this.iconPathPreview(),
    }, { emitEvent: false });
    if (item.is_stackable) {
      this.form.controls.max_quantity.enable({ emitEvent: false });
    } else {
      this.form.controls.max_quantity.disable({ emitEvent: false });
    }
    this.updateStatusEffectValidators();
    this.iconPathPreview.set(item.icon_path ?? 'items/new_item.png');
    const url = item.icon_path ? this.auth.getAssetUrl(item.icon_path.startsWith('/') ? item.icon_path : `/${item.icon_path}`) : null;
    this.imagePreview.set(url);
  }

  private bindFormLogic(): void {
    this.form.controls.is_stackable.valueChanges.subscribe((stackable) => {
      const maxQuantityCtrl = this.form.controls.max_quantity;
      if (stackable) {
        maxQuantityCtrl.enable({ emitEvent: false });
        const num = Math.min(5, Math.max(1, Number(maxQuantityCtrl.value ?? 1) || 1));
        maxQuantityCtrl.setValue(String(num), { emitEvent: false });
      } else {
        maxQuantityCtrl.setValue('1', { emitEvent: false });
        maxQuantityCtrl.disable({ emitEvent: false });
      }
    });

    this.form.controls.effect_type.valueChanges.subscribe((effectType) => {
      const statusCtrl = this.form.controls.status_effect_id;
      if (effectType === 'Apply Status Effects') {
        statusCtrl.setValidators([Validators.required]);
      } else {
        statusCtrl.setValidators([]);
        statusCtrl.setValue(null, { emitEvent: false });
      }
      statusCtrl.updateValueAndValidity({ emitEvent: false });
    });

    this.updateStatusEffectValidators();

    this.form.controls.name.valueChanges.subscribe(() => this.refreshIconPathPreview());
  }

  private updateStatusEffectValidators(): void {
    const isApplyStatus = this.form.controls.effect_type.value === 'Apply Status Effects';
    const statusCtrl = this.form.controls.status_effect_id;
    if (isApplyStatus) {
      statusCtrl.setValidators([Validators.required]);
    } else {
      statusCtrl.setValidators([]);
    }
    statusCtrl.updateValueAndValidity({ emitEvent: false });
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Please select a valid image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('Image must be less than 10MB.');
      return;
    }

    this.errorMessage.set(null);
    this.selectedImage.set(file);
    this.refreshIconPathPreview();
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set((reader.result as string) || null);
    reader.readAsDataURL(file);
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  getErrorMessage(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }
    const errors = control.errors;
    if (errors['required']) return 'This field is required.';
    if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters.`;
    if (errors['min']) return `Minimum value is ${errors['min'].min}.`;
    if (errors['max']) return `Maximum value is ${errors['max'].max}.`;
    if (errors['pattern']) {
      return 'Only numbers are allowed.';
    }
    return 'Invalid value.';
  }

  getSelectedEffectType(): string {
    return this.form.controls.effect_type.value ?? '';
  }

  selectEffectType(effectType: string): void {
    this.form.controls.effect_type.setValue(effectType);
    this.form.controls.effect_type.markAsTouched();
    this.effectTypeDropdownOpen.set(false);
  }

  closeEffectTypeDropdown(): void {
    this.effectTypeDropdownOpen.set(false);
  }

  onEffectTypeFocusOut(event: FocusEvent): void {
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || (next && wrapper.contains(next))) return;
    this.closeEffectTypeDropdown();
  }

  getSelectedStatusEffect(): AdminDropdownOption | undefined {
    const id = this.form.controls.status_effect_id.value;
    if (id == null) return undefined;
    return this.statusEffects().find((e) => e.id === id);
  }

  getStatusEffectIconUrl(iconPath: string | undefined): string {
    if (!iconPath) return '';
    const path = iconPath.startsWith('/') ? iconPath : `/${iconPath}`;
    return this.auth.getAssetUrl(path);
  }

  selectStatusEffect(effect: AdminDropdownOption | null): void {
    this.form.controls.status_effect_id.setValue(effect?.id ?? null);
    this.form.controls.status_effect_id.markAsTouched();
    this.statusEffectDropdownOpen.set(false);
  }

  closeStatusEffectDropdown(): void {
    this.statusEffectDropdownOpen.set(false);
  }

  onStatusEffectFocusOut(event: FocusEvent): void {
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || (next && wrapper.contains(next))) return;
    this.closeStatusEffectDropdown();
  }

  readonly statusEffectDropdownOpen = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.effectTypeDropdownOpen()) this.closeEffectTypeDropdown();
    if (this.statusEffectDropdownOpen()) this.closeStatusEffectDropdown();
  }

  submit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.itemId();
    if (id == null) {
      this.errorMessage.set('Invalid item.');
      return;
    }

    const raw = this.form.getRawValue();
    const effectValue = raw.effect_value;
    const formData = new FormData();
    formData.append('name', (raw.name ?? '').trim());
    formData.append('description', (raw.description ?? '').trim());
    formData.append('effect_type', raw.effect_type ?? '');
    if (effectValue !== null && effectValue !== undefined && String(effectValue).trim() !== '') {
      formData.append('effect_value', String(effectValue));
    }
    formData.append('is_stackable', raw.is_stackable ? '1' : '0');
    const maxQty = raw.is_stackable ? (Number(raw.max_quantity) || 1) : 1;
    formData.append('max_quantity', String(Math.min(5, Math.max(1, maxQty))));
    if (raw.status_effect_id) {
      formData.append('status_effect_id', String(raw.status_effect_id));
    }
    const icon = this.selectedImage();
    if (icon) {
      const fileName = this.buildFileName(raw.name ?? 'new_item', icon.name);
      formData.append('icon', icon, fileName);
    }

    this.isSaving.set(true);
    this.adminService.updateItem(id, formData)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Item updated successfully.');
          this.router.navigateByUrl('/admin/items');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? "Couldn't update item.");
        },
      });
  }

  goBack(): void {
    this.router.navigateByUrl('/admin/items');
  }

  private refreshIconPathPreview(): void {
    const name = this.form.controls.name.value ?? 'new_item';
    const currentIcon = this.selectedImage();
    const fileName = this.buildFileName(name, currentIcon?.name);
    this.iconPathPreview.set(`items/${fileName}`);
    this.form.controls.icon_path.setValue(this.iconPathPreview(), { emitEvent: false });
  }

  private buildFileName(rawName: string, originalName?: string): string {
    const safeBase = (rawName || 'new_item')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'new_item';
    const ext = (originalName?.split('.').pop()?.toLowerCase() ?? 'png').replace(/[^a-z0-9]/g, '') || 'png';
    return `${safeBase}.${ext}`;
  }
}
