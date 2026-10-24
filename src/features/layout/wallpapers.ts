import type { WallpaperId } from '../../types/settings';

export interface WallpaperPreset {
  id: WallpaperId;
  name: string;
  description: string;
  background: string;
}

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'sunrise',
    name: '晨光',
    description: '桃色日照与冷调晨雾',
    background: [
      'radial-gradient(125% 105% at 86% -12%, #ffc7a4 0%, rgba(255, 199, 164, 0) 54%)',
      'radial-gradient(115% 100% at -6% 104%, #b9cff4 0%, rgba(185, 207, 244, 0) 56%)',
      'radial-gradient(70% 55% at 28% 104%, #f3e2f2 0%, rgba(243, 226, 242, 0) 62%)',
      'linear-gradient(152deg, #eef2fb 0%, #dfe7f5 52%, #e5eaf5 100%)',
    ].join(', '),
  },
  {
    id: 'mint',
    name: '薄荷',
    description: '雨后薄荷与浅蓝',
    background: [
      'radial-gradient(120% 100% at 86% -6%, #bfe8d6 0%, rgba(191, 232, 214, 0) 55%)',
      'radial-gradient(110% 100% at -4% 100%, #c5dcf8 0%, rgba(197, 220, 248, 0) 58%)',
      'radial-gradient(65% 60% at 50% 58%, #f7fdfa 0%, rgba(247, 253, 250, 0) 72%)',
      'linear-gradient(150deg, #eaf3f0 0%, #dce9ef 100%)',
    ].join(', '),
  },
  {
    id: 'dune',
    name: '沙丘',
    description: '暖沙与傍晚的灰蓝',
    background: [
      'radial-gradient(120% 100% at 84% 0%, #f3ddc2 0%, rgba(243, 221, 194, 0) 52%)',
      'radial-gradient(115% 100% at 0% 100%, #d6dfef 0%, rgba(214, 223, 239, 0) 58%)',
      'radial-gradient(70% 60% at 45% 48%, #fbf6ee 0%, rgba(251, 246, 238, 0) 70%)',
      'linear-gradient(150deg, #f0ece5 0%, #e2e7ef 100%)',
    ].join(', '),
  },
  {
    id: 'dusk',
    name: '暮色',
    description: '淡玫瑰与黄昏紫',
    background: [
      'radial-gradient(125% 100% at 84% -4%, #f2d2e4 0%, rgba(242, 210, 228, 0) 54%)',
      'radial-gradient(115% 100% at 0% 100%, #cfd5fa 0%, rgba(207, 213, 250, 0) 58%)',
      'radial-gradient(70% 62% at 45% 50%, #fcf4f6 0%, rgba(252, 244, 246, 0) 72%)',
      'linear-gradient(150deg, #eeeef9 0%, #e2e3f0 100%)',
    ].join(', '),
  },
  {
    id: 'paper',
    name: '素纸',
    description: '几乎中性的浅灰',
    background: [
      'radial-gradient(120% 100% at 82% -2%, #ffffff 0%, rgba(255, 255, 255, 0) 52%)',
      'radial-gradient(115% 100% at 0% 100%, #d4e0f2 0%, rgba(212, 224, 242, 0) 58%)',
      'radial-gradient(72% 62% at 50% 44%, #fafcff 0%, rgba(250, 252, 255, 0) 72%)',
      'linear-gradient(150deg, #edf0f5 0%, #e1e7f0 100%)',
    ].join(', '),
  },
];

export function getWallpaper(id: WallpaperId | undefined): WallpaperPreset {
  return WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? WALLPAPERS[0]!;
}
