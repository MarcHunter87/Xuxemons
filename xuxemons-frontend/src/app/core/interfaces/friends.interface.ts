export interface FriendUser {
  id: string;
  name: string;
  level?: number;
  icon_path?: string | null;
  status?: 'online' | 'away' | 'offline';
  last_seen?: string | null;
}

export interface FriendRequestItem {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_level?: number;
  sender_icon_path?: string | null;
  created_at: string;
}

export interface SearchUser {
  id: string;
  name: string;
  level?: number;
  icon_path?: string | null;
  request_sent?: boolean;
  request_received?: boolean;
}
