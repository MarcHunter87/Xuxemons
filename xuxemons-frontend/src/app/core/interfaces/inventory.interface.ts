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
