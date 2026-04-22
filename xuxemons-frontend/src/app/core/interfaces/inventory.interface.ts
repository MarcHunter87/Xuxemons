// Sirve para definir la interfaz de un item de la API
export interface ApiInventoryItem {
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

// Sirve para definir la interfaz de un item del inventario
export interface InventoryItem {
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

export type XuxemonSize = 'Small' | 'Medium' | 'Large';

// Sirve para definir la interfaz de los datos de respuesta al usar un item
export interface UseItemResponseData {
  previous_size?: XuxemonSize;
  xuxemon_size?: XuxemonSize;
  requirement_progress: number;
  remaining_quantity: number;
}

// Sirve para definir la interfaz de la respuesta de la API del inventario
export interface InventoryApiResponse {
  message?: string;
  data: {
    items: ApiInventoryItem[];
    max_slots?: number;
    used_slots?: number;
    available_slots?: number;
    max_capacity?: number;
    capacity?: number;
  };
}
