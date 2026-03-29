export interface AdminUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'admin' | 'player';
}

export interface BagStatus {
  max_slots: number;
  used_slots: number;
  available_slots: number;
}

export interface AdminDropdownOption {
  id: number;
  name: string;
  icon_path?: string;
}

export interface AdminCreationMeta {
  types: AdminDropdownOption[];
  attacks: AdminDropdownOption[];
  status_effects: AdminDropdownOption[];
}

export interface DailyReward {
  id: number;
  time: string;
  quantity: number;
  item_id: number | null;
  item_name?: string | null;
}

export interface SideEffect {
  id: number;
  name: string;
  description: string | null;
  icon_path: string;
  apply_chance: number | null;
}
