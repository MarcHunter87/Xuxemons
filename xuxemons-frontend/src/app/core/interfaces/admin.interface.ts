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
