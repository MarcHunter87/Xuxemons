export interface Xuxemon {
  id: number;
  name: string;
  type: { name: string };
  size: 'Small' | 'Medium' | 'Large';
  image_url: string;
  statusEffect?: {
    name: string;
    icon_url: string;
  };
  description?: string;
  adquired_at?: string;
  level?: number;
  hp?: number;
  current_hp?: number;
  attack?: number;
  defense?: number;
  attacks?: Array<{
    id: number;
    name: string;
    description?: string;
    dmg?: number;
    status_chance?: number | null;
    statusEffect?: {
      name: string;
      icon_url: string;
    };
  }>;
}
