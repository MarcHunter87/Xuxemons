import { Component, ChangeDetectionStrategy, inject, afterNextRender, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ApiInventoryItem {
  id: string | number;
  name: string;
  description: string;
  quantity: number;
  icon_path: string;
  effect_type: string;
  effect_value: number;
  is_stackable: boolean;
  max_quantity: number;
  bag_item_id?: number;
}

interface InventoryItem {
  id: string | number;
  name: string;
  iconPath: string;
  quantity: number;
  category: string;
  type: string;
  description: string;
  effect: string;
  effect_type?: string;
  effect_value?: number;
  is_stackable?: boolean;
  max_quantity?: number;
  bag_item_id?: number;
}

@Component({
  selector: 'app-inventory',
  imports: [NgClass, FormsModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/inventory';

  constructor() {
    afterNextRender(() => {
      this.loadInventory();
    });
  }

  readonly selectedItem = signal<InventoryItem | null>(null);
  readonly maxSlots = 20;
  readonly maxCapacity = signal(0);
  readonly maxSlotsFromBackend = signal(0);
  readonly usedSlotsFromBackend = signal(0);
  readonly items = signal<InventoryItem[]>([]);
  readonly filteredItems = signal<InventoryItem[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedFilter = signal('all');
  readonly availableEffectTypes = signal<string[]>([]);
  readonly discardMode = signal(false);
  readonly discardQuantity = signal(1);
  readonly discardError = signal<string | null>(null);
  readonly discardApiError = signal<string | null>(null);
  readonly isDiscarding = signal(false);

  readonly emptySlots = computed(() => {
    const remaining = this.maxSlots - this.filteredItems().length;
    return Array(Math.max(0, remaining)).fill(0);
  });

  readonly usedCapacity = computed(() =>
    this.usedSlotsFromBackend() > 0 ? this.usedSlotsFromBackend() : this.items().length
  );

  readonly totalCapacity = computed(() =>
    this.maxSlotsFromBackend() > 0 ? this.maxSlotsFromBackend() : 50
  );

  readonly availableCapacity = computed(() => this.totalCapacity() - this.usedCapacity());

  /**
   * Carga el inventario desde la API
   */
  loadInventory(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    console.log('🔄 Iniciando carga del inventario desde:', this.apiUrl);

    this.http.get<{ message: string; data: { items: ApiInventoryItem[], max_slots?: number, used_slots?: number, available_slots?: number, max_capacity?: number, capacity?: number } }>(this.apiUrl).subscribe({
      next: (response) => {
        console.log('✅ Inventario cargado exitosamente:', response);
        console.log('📦 Items recibidos:', response.data.items);
        const transformed = this.transformApiItems(response.data.items)
          .sort((a, b) => (a.effect_type ?? '').localeCompare(b.effect_type ?? ''));
        this.items.set(transformed);
        this.maxSlotsFromBackend.set(response.data.max_slots || 20);
        this.usedSlotsFromBackend.set(response.data.used_slots || 0);
        this.maxCapacity.set(response.data.max_slots || 20);
        this.extractEffectTypes();
        this.filteredItems.set(transformed);
        console.log('✨ Items transformados:', transformed);
        this.isLoading.set(false);
        if (transformed.length > 0) {
          this.selectItem(transformed[0]);
        }
      },
      error: (error) => {
        console.error('❌ Error cargando inventario:', error);
        this.errorMessage.set(`Failed to load inventory. Error: ${error.status} - ${error.message}`);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Transforma los items de la API al formato del componente
   * Si el item no es stackable, crea una entrada separada para cada unidad
   */
  private transformApiItems(apiItems: ApiInventoryItem[]): InventoryItem[] {
    return apiItems.map(item => {
      const path = item.icon_path.startsWith('/') ? item.icon_path : `/${item.icon_path}`;
      return {
        id: item.id,
        name: item.name,
        iconPath: `http://localhost:8080${path}`,
        category: item.effect_type,
        type: item.effect_type,
        description: item.description,
        effect: this.getEffectString(item.effect_type, item.effect_value),
        effect_type: item.effect_type,
        effect_value: item.effect_value,
        is_stackable: item.is_stackable,
        max_quantity: item.max_quantity,
        quantity: item.quantity,
        bag_item_id: item.bag_item_id,
      };
    });
  }




  /**
   * Obtiene la cadena de efecto formateada
   */
  private getEffectString(effectType: string, effectValue?: number): string {
    if (!effectValue) return 'Cure all status effects';

    const effectMap: { [key: string]: string } = {
      'healing': `+${effectValue}% HP`,
      'mana': `+${effectValue}% Mana`,
      'xp': `+${effectValue}% XP`,
    };
    return effectMap[effectType] || `Effect: ${effectValue}`;
  }

  /**
   * Extrae los tipos de efectos únicos de los items
   */
  private extractEffectTypes(): void {
    const effectTypes = new Set<string>();
    this.items().forEach(item => {
      if (item.effect_type) {
        effectTypes.add(item.effect_type);
      }
    });
    this.availableEffectTypes.set(Array.from(effectTypes).sort());
  }

  /**
   * Aplica el filtro de effect_type a los items
   */
  applyFilter(effectType: string): void {
    this.selectedFilter.set(effectType);
    if (effectType === 'all') {
      this.filteredItems.set(this.items());
    } else {
      this.filteredItems.set(this.items().filter(item => item.effect_type === effectType));
    }
    this.selectedItem.set(null);
  }

  selectItem(item: InventoryItem): void {
    this.selectedItem.set(item);
  }

  useItem(): void {
    const item = this.selectedItem();
    if (item && item.quantity > 0) {
      console.log('Using item:', item.name);
      // Implement use logic here
    }
  }

  discardItem(): void {
    const item = this.selectedItem();
    if (!item || !item.bag_item_id) return;

    if (item.quantity === 1) {
      this.callDiscardApi(item.bag_item_id, 1);
    } else {
      this.discardQuantity.set(1);
      this.discardError.set(null);
      this.discardApiError.set(null);
      this.discardMode.set(true);
    }
  }

  updateDiscardQuantity(val: number): void {
    const max = this.selectedItem()?.quantity ?? 1;
    const parsed = Math.floor(val);
    this.discardQuantity.set(parsed);
    this.discardApiError.set(null);
    if (!parsed || isNaN(parsed)) {
      this.discardError.set('Please enter a valid number.');
    } else if (parsed < 1) {
      this.discardError.set('Quantity must be at least 1.');
    } else if (parsed > max) {
      this.discardError.set(`You only have ${max} unit${max > 1 ? 's' : ''} in stock.`);
    } else {
      this.discardError.set(null);
    }
  }

  confirmDiscard(): void {
    const item = this.selectedItem();
    if (!item || !item.bag_item_id) return;
    const qty = this.discardQuantity();
    if (qty < 1 || qty > item.quantity || this.discardError()) return;
    this.callDiscardApi(item.bag_item_id, qty);
  }

  cancelDiscard(): void {
    this.discardMode.set(false);
    this.discardError.set(null);
    this.discardApiError.set(null);
  }

  private callDiscardApi(bagItemId: number, quantity: number): void {
    this.isDiscarding.set(true);
    this.http.delete<{ message: string; remaining: number }>(
      `http://localhost:8080/api/inventory/item/${bagItemId}`,
      { body: { quantity } }
    ).subscribe({
      next: (res) => {
        const item = this.selectedItem()!;
        if (res.remaining === 0) {
          this.items.update(items => items.filter(i => i.bag_item_id !== bagItemId));
          this.filteredItems.update(items => items.filter(i => i.bag_item_id !== bagItemId));
          this.selectedItem.set(null);
        } else {
          const newQty = item.quantity - quantity;
          const updatedItem = { ...item, quantity: newQty };
          this.items.update(items => items.map(i => i.id === item.id ? updatedItem : i));
          this.filteredItems.update(items => items.map(i => i.id === item.id ? updatedItem : i));
          this.selectedItem.set(updatedItem);
        }
        this.discardMode.set(false);
        this.isDiscarding.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Unexpected error. Please try again.';
        this.discardApiError.set(msg);
        this.isDiscarding.set(false);
      }
    });
  }

  getSlotClass(item: InventoryItem): string {
    const effectType = (item.effect_type || 'default').toLowerCase().trim().replace(/ /g, '-');
    return `slot-bg-${effectType}`;
  }

  getTagClass(): string {
    const item = this.selectedItem();
    if (!item) return 'tag-default';
    const effectType = (item.effect_type || 'default').toLowerCase().trim().replace(/ /g, '-');
    return `tag-${effectType}`;
  }

  getIconBackgroundClass(): string {
    const item = this.selectedItem();
    if (!item) return 'icon-bg-default';
    const effectType = (item.effect_type || 'default').toLowerCase().trim().replace(/ /g, '-');
    return `icon-bg-${effectType}`;
  }
}
