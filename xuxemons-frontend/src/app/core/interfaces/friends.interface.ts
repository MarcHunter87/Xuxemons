// Sirve para definir la interfaz de un usuario amigo
export interface FriendUser {
  id: string;
  name: string;
  level?: number;
  icon_path?: string | null;
  status?: 'online' | 'offline';
  last_seen?: string | null;
}

// Sirve para definir la interfaz de una solicitud de amistad
export interface FriendRequestItem {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_level?: number;
  sender_icon_path?: string | null;
  created_at: string;
}

// Sirve para definir la interfaz de un usuario buscado
export interface SearchUser {
  id: string;
  name: string;
  level?: number;
  icon_path?: string | null;
  request_sent?: boolean;
  request_received?: boolean;
  is_friend?: boolean;
}
