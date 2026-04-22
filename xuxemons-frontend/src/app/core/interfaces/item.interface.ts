// Sirve para definir la interfaz de un item
export interface Item {
  id: number;
  name: string;
  description: string;
  effect_type: string;
  effect_value?: number;
  is_stackable: boolean;
  max_quantity: number;
  status_effect_id?: number | null;
  status_effect?: { name: string } | null;
  icon_path: string;
  updated_at?: string;
}
