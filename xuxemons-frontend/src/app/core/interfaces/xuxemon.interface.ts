export interface Xuxemon {
  id: number;
  name: string;
  type: { name: string };
  size: 'Small' | 'Medium' | 'Large';
  image_url: string;
  adquired_at?: string;
  hp?: number;
  attack?: number;
  defense?: number;
}
