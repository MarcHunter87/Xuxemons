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

export interface UseItemResponseData {
  error?: boolean;
  message?: string;
  current_hp?: number;
  max_hp?: number;
  current_attack?: number;
  current_defense?: number;
  gluttony_blocked?: boolean;
  overdose_blocked?: boolean;
  starving_blocked?: boolean;
  starving_info?: string;
  overdose_info?: string;
  previous_size?: XuxemonSize;
  xuxemon_size?: XuxemonSize;
  requirement_progress?: number;
  remaining_quantity?: number;
  applied_status_effect?: {
    id?: number;
    name: string;
    description?: string;
    icon_path?: string;
    icon_url?: string;
  };
}
