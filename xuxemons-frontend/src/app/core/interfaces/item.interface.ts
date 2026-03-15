export interface Item {
  id: number;
  name: string;
  description: string;
  is_stackable: boolean;
  max_quantity: number;
  icon_path: string;
  effect_type: string;
  effect_value?: number;
}
