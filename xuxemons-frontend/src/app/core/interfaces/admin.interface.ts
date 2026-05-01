// Sirve para definir la interfaz de un usuario administrador
export interface AdminUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'admin' | 'player';
}

// Sirve para definir la interfaz de los datos de estado de la bolsa
export interface BagStatus {
  max_slots: number;
  used_slots: number;
  available_slots: number;
}

// Sirve para definir la interfaz de un elemento del dropdown de administración
export interface AdminDropdownOption {
  id: number;
  name: string;
  icon_path?: string;
}

// Sirve para definir la interfaz de los metadatos de creación
export interface AdminCreationMeta {
  types: AdminDropdownOption[];
  attacks: AdminDropdownOption[];
  status_effects: AdminDropdownOption[];
}

// Sirve para definir la interfaz de una recompensa diaria
export interface DailyReward {
  id: number;
  time: string;
  quantity: number;
  item_id: number | null;
  item_name?: string | null;
}

// Sirve para definir la interfaz de un efecto secundario
export interface SideEffect {
  id: number;
  name: string;
  description: string | null;
  icon_path: string;
  apply_chance: number | null;
}
