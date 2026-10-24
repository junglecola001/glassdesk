import { useEffect, useRef, useState } from 'react';
import type { WallpaperPreset } from '../../features/layout/wallpapers';

interface Layer {
  key: number;
  preset: WallpaperPreset;
}

export function Wallpaper({ preset }: { preset: WallpaperPreset }) {
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, preset }]);
  const counter = useRef(0);

  useEffect(() => {
    setLayers((previous) => {
      if (previous[previous.length - 1]?.preset.id === preset.id) return previous;
      counter.current += 1;
      return [...previous.slice(-1), { key: counter.current, preset }];
    });
  }, [preset]);

  useEffect(() => {
    if (layers.length < 2) return;
    const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), 640);
    return () => window.clearTimeout(timer);
  }, [layers.length]);

  return (
    <div className="wallpaper-stack" aria-hidden="true">
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className={`wallpaper-layer${
            index === layers.length - 1 && layers.length > 1 ? ' wallpaper-layer--incoming' : ''
          }`}
          style={{ background: layer.preset.background }}
        />
      ))}
    </div>
  );
}
