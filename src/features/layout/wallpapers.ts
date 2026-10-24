import type { WallpaperId } from '../../types/settings';

export interface WallpaperPreset {
  id: WallpaperId;
  name: string;
  description: string;
  background: string;
  thumbnail: string;
}

interface WallpaperSource {
  id: WallpaperId;
  name: string;
  description: string;
  file: string;
}

const SOURCES: WallpaperSource[] = [
  {
    id: 'dusk',
    name: '深海蓝',
    description: '索诺玛式蓝色光刃',
    file: 'deep-blue.jpg',
  },
  {
    id: 'sunrise',
    name: '流光金',
    description: '香槟金属与丝绸',
    file: 'gold-flow.jpg',
  },
  {
    id: 'mint',
    name: '青雾',
    description: '冷青色光刃',
    file: 'teal-flow.jpg',
  },
  {
    id: 'dune',
    name: '暮紫',
    description: '靛蓝与紫外光',
    file: 'violet-flow.jpg',
  },
  {
    id: 'paper',
    name: '石墨',
    description: '低调的黑色金属',
    file: 'graphite-flow.jpg',
  },
];

export const WALLPAPERS: WallpaperPreset[] = SOURCES.map((source) => ({
  id: source.id,
  name: source.name,
  description: source.description,
  background: `url("/wallpapers/${source.file}") center / cover no-repeat`,
  thumbnail: `url("/wallpapers/thumbs/${source.file}") center / cover no-repeat`,
}));

export function getWallpaper(id: WallpaperId | undefined): WallpaperPreset {
  return WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? WALLPAPERS[0]!;
}
