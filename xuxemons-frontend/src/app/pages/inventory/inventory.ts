import { Component, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface ApiInventoryItem {
  id: number;
  name: string;
  description: string;
  quantity: number;
  icon_path: string;
  effect_type: string;
  effect_value: number;
  is_stackable: boolean;
  max_quantity: number;
}

interface InventoryItem {
  id: number;
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
}

@Component({
  selector: 'app-inventory',
  imports: [],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private apiUrl = 'http://localhost:8080/api/inventory';

  selectedItem: InventoryItem | null = null;
  maxSlots = 20; // 4x5 grid
  items: InventoryItem[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadInventory();
  }

  /**
   * Carga el inventario desde la API
   */
  loadInventory(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    console.log('🔄 Iniciando carga del inventario desde:', this.apiUrl);

    this.http.get<{ message: string; data: { items: ApiInventoryItem[] } }>(this.apiUrl).subscribe({
      next: (response) => {
        console.log('✅ Inventario cargado exitosamente:', response);
        console.log('📦 Items recibidos:', response.data.items);
        this.items = this.transformApiItems(response.data.items);
        console.log('✨ Items transformados:', this.items);
        this.isLoading = false;
        this.cdr.markForCheck();
        // Seleccionar el primer item por defecto si existe
        if (this.items.length > 0) {
          this.selectItem(this.items[0]);
          console.log('🎯 Item seleccionado:', this.items[0]);
        } else {
          console.log('⚠️ No hay items en el inventario');
        }
      },
      error: (error) => {
        console.error('❌ Error cargando inventario:', error);
        console.error('Status:', error.status);
        console.error('Mensaje:', error.message);
        console.error('Respuesta completa:', error);
        this.errorMessage = `Failed to load inventory. Error: ${error.status} - ${error.message}`;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Transforma los items de la API al formato del componente
   * Si el item no es stackable, crea una entrada separada para cada unidad
   */
  private transformApiItems(apiItems: ApiInventoryItem[]): InventoryItem[] {
    const transformedItems: InventoryItem[] = [];

    apiItems.forEach(item => {
      const path = item.icon_path.startsWith('/') ? item.icon_path : `/${item.icon_path}`;
      const baseItem = {
        id: item.id,
        name: item.name,
        iconPath: `http://localhost:8080${path}`,
        category: this.getCategoryFromType(item.effect_type),
        type: item.effect_type,
        description: item.description,
        effect: this.getEffectString(item.effect_type, item.effect_value),
        effect_type: item.effect_type,
        effect_value: item.effect_value,
        is_stackable: item.is_stackable,
        max_quantity: item.max_quantity,
      };

      // Si es stackable, agregarlo una sola vez con su cantidad total
      if (item.is_stackable) {
        transformedItems.push({
          ...baseItem,
          quantity: item.quantity,
        });
      } else {
        // Si no es stackable, crear una entrada para cada unidad
        for (let i = 0; i < item.quantity; i++) {
          transformedItems.push({
            ...baseItem,
            quantity: 1,
          });
        }
      }
    });

    return transformedItems;
  }



  /**
   * Obtiene la categoría basada en el tipo de efecto
   */
  private getCategoryFromType(effectType: string): string {
    const categoryMap: { [key: string]: string } = {
      'healing': 'Consumable',
      'mana': 'Consumable',
      'status': 'Consumable',
      'revival': 'Consumable',
      'buff': 'Consumable',
      'level_up': 'Consumable',
      'capture': 'Capture',
    };
    return categoryMap[effectType] || 'Item';
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

  get emptySlots(): number[] {
    const remaining = this.maxSlots - this.items.length;
    return Array(remaining).fill(0);
  }

  selectItem(item: InventoryItem): void {
    this.selectedItem = item;
  }

  useItem(): void {
    if (this.selectedItem && this.selectedItem.quantity > 0) {
      console.log('Using item:', this.selectedItem.name);
      // Implement use logic here
    }
  }

  discardItem(): void {
    if (this.selectedItem) {
      const index = this.items.findIndex(i => i.id === this.selectedItem!.id);
      if (index !== -1) {
        this.items[index].quantity--;
        if (this.items[index].quantity === 0) {
          this.items.splice(index, 1);
          this.selectedItem = null;
        } else {
          this.selectedItem = { ...this.items[index] };
        }
      }
    }
  }
}
