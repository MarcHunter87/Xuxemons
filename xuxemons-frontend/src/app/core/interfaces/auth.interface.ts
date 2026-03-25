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
}

export interface RegisterPayload {
  id: string;
  name: string;
  surname: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginPayload {
  id: string;
  password: string;
}

export interface UpdatePersonalInfoPayload {
  name: string;
  surname: string;
  email: string;
}

export interface UpdatePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AuthResponse {
  access_token?: string;
  user?: User;
}

export interface UpdatePersonalInfoResponse {
  message: string;
  user: User;
  errors?: Record<string, string[]>;
}

export interface UpdatePasswordResponse {
  message: string;
  errors?: Record<string, string[]>;
}

export interface DeactivateAccountResponse {
  message: string;
  errors?: Record<string, string[]>;
}
