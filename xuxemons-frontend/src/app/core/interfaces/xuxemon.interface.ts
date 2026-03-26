export interface Xuxemon {
  id: number;
  name: string;
  type: { name: string };
  size: 'Small' | 'Medium' | 'Large';
  image_url: string;
  adquired_id?: number;
  statusEffect?: {
    name: string;
    icon_url: string;
  };
  side_effect_1?: {
    name: string;
    description?: string;
    icon_url: string;
  };
  side_effect_2?: {
    name: string;
    description?: string;
    icon_url: string;
  };
  side_effect_3?: {
    name: string;
    description?: string;
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
