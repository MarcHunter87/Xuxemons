import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AdminService } from '../../core/services/admin';
import { AuthService } from '../../core/services/auth';
import { Item } from '../../core/interfaces';

@Component({
  selector: 'app-give-item-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './give-item-form.html',
  styleUrl: './give-item-form.css',
})
export class GiveItemForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  form: FormGroup;
  userId = '';
  readonly items = signal<Item[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly dropdownOpen = signal(false);

  constructor() {
    this.form = this.fb.group({
      itemId: ['', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('userId');
    const userId = raw ? decodeURIComponent(raw) : null;

    if (!userId) {
      this.router.navigate(['/admin']);
      return;
    }

    this.userId = userId;
    this.loadFormData();
  }

  private loadFormData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getAllItems()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          const data = response?.data;
          this.items.set(Array.isArray(data) ? data : []);
          if (!Array.isArray(data)) {
            this.errorMessage.set('Unexpected response while loading items');
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to load items');
        },
      });
  }

  onItemChange(): void {
    const itemIdControl = this.form.get('itemId');
    const quantityControl = this.form.get('quantity');

    if (!itemIdControl || !quantityControl) return;

    const selectedItemId = itemIdControl.value;
    const selectedItem = this.items().find((item) => item.id === parseInt(selectedItemId));

    if (selectedItem) {
      quantityControl.setValidators([Validators.required, Validators.min(1)]);
      quantityControl.updateValueAndValidity();
      quantityControl.setValue(1);
    } else {
      quantityControl.clearValidators();
      quantityControl.updateValueAndValidity();
    }
  }

  getSelectedItem(): Item | undefined {
    const itemIdControl = this.form.get('itemId');
    if (!itemIdControl?.value) return undefined;
    return this.items().find((item) => item.id === parseInt(itemIdControl.value));
  }

  getItemImageUrl(item: Item): string {
    const path = item.icon_path?.startsWith('/') ? item.icon_path : `/${item.icon_path || ''}`;
    return this.authService.getAssetUrl(path);
  }

  selectItem(item: Item): void {
    this.form.get('itemId')?.setValue(String(item.id));
    this.onItemChange();
    this.dropdownOpen.set(false);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dropdownOpen()) this.closeDropdown();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please complete all fields correctly');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const itemId = parseInt(this.form.get('itemId')!.value);
    const quantity = this.form.get('quantity')!.value;

    this.adminService
      .giveItemToUser(this.userId, itemId, quantity)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response: any) => {
          const itemName = this.getSelectedItem()?.name ?? 'Item';
          const discarded = Number(response?.data?.discarded_quantity ?? 0);
          const added = Number(response?.data?.added_quantity ?? quantity);
          if (discarded > 0) {
            this.successMessage.set(`${added} ${itemName} added, ${discarded} discarded (bag full).`);
          } else {
            this.successMessage.set(`${added} ${itemName} given successfully.`);
          }
          this.form.reset({ itemId: '', quantity: 1 });

          setTimeout(() => {
            this.router.navigate(['/admin']);
          }, 1500);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Failed to give item');
        },
      });
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
    if (errors['required']) return 'This field is required';
    if (errors['min']) return `Minimum quantity is ${errors['min'].min}`;
    if (errors['max']) return `Maximum quantity is ${errors['max'].max}`;

    return 'Invalid value';
  }
}
