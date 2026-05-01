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
  updated_at?: string;
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
  error?: boolean;
  message?: string;
  previous_hp?: number;
  healed_amount?: number;
  current_hp?: number;
  max_hp?: number;
  previous_attack?: number;
  attack_gained?: number;
  current_attack?: number;
  previous_defense?: number;
  defense_gained?: number;
  current_defense?: number;
  previous_size?: XuxemonSize;
  xuxemon_size?: XuxemonSize;
  requirement_progress?: number;
  requirement_total?: number;
  progress_gained?: number;
  meat_used?: number;
  starving_penalty_applied?: boolean;
  starving_info?: string;
  gluttony_blocked?: boolean;
  gluttony_info?: string;
  starving_blocked?: boolean;
  overdose_blocked?: boolean;
  overdose_info?: string;
  remaining_quantity?: number;
  applied_status_effect?: {
    name?: string;
    icon_url?: string;
    icon_path?: string;
  };
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
