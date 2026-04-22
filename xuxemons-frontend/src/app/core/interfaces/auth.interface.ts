// Sirve para definir la interfaz de un usuario
export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'admin' | 'player';
  icon_path?: string | null;
  banner_path?: string | null;
  view_animations?: boolean;
  updated_at?: string;
  level?: number;
  xp?: number;
  win_streak?: number;
  total_battles?: number;
  theme?: 'light' | 'dark';
}

// Sirve para definir la interfaz de los datos de registro
export interface RegisterPayload {
  id: string;
  name: string;
  surname: string;
  email: string;
  password: string;
  password_confirmation: string;
}

// Sirve para definir la interfaz de los datos de inicio de sesión
export interface LoginPayload {
  id: string;
  password: string;
}

// Sirve para definir la interfaz de los datos de actualización de información personal
export interface UpdatePersonalInfoPayload {
  name?: string;
  surname?: string;
  email?: string;
  view_animations?: boolean;
  theme?: 'light' | 'dark';
}

// Sirve para definir la interfaz de los datos de actualización de contraseña
export interface UpdatePasswordPayload {
  current_password: string;
  new_password: string;
}

// Sirve para definir la interfaz de la respuesta de autenticación
export interface AuthResponse {
  access_token?: string;
  user?: User;
}

// Sirve para definir la interfaz de la respuesta de actualización de información personal
export interface UpdatePersonalInfoResponse {
  message: string;
  user: User;
  errors?: Record<string, string[]>;
}

// Sirve para definir la interfaz de la respuesta de actualización de contraseña
export interface UpdatePasswordResponse {
  message: string;
  errors?: Record<string, string[]>;
}

// Sirve para definir la interfaz de la respuesta de desactivación de cuenta
export interface DeactivateAccountResponse {
  message: string;
  errors?: Record<string, string[]>;
}

// Sirve para definir la interfaz de un elemento de notificación de recompensa diaria
export interface DailyRewardNotificationItem {
  item_id: number;
  name: string;
  icon_path?: string | null;
  effect_type?: string | null;
  quantity: number;
}

// Sirve para definir la interfaz de la notificación de recompensa diaria
export interface DailyRewardNotification {
  id: number;
  reward_date: string;
  gacha_ticket: {
    name: string;
    icon_path?: string | null;
    effect_type?: string | null;
    quantity: number;
  };
  items: DailyRewardNotificationItem[];
}

// Sirve para definir la interfaz de la respuesta de la notificación de recompensa diaria
export interface DailyRewardNotificationResponse {
  data: DailyRewardNotification | null;
}
