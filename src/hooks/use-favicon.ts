import { useEffect, useState } from 'react';
import { faviconUrl } from '../services/browser-api';

interface FaviconState {
  src: string | null;
  loaded: boolean;
  failed: boolean;
  onLoad: () => void;
  onError: () => void;
}

export function useFavicon(url: string | null | undefined, size = 64): FaviconState {
  const src = faviconUrl(url, size);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (loadedSrc && loadedSrc !== src) setLoadedSrc(null);
    if (failedSrc && failedSrc !== src) setFailedSrc(null);
  }, [failedSrc, loadedSrc, src]);

  const usable = src && src !== failedSrc ? src : null;

  return {
    src: usable,
    loaded: Boolean(usable && loadedSrc === usable),
    failed: Boolean(src && failedSrc === src),
    onLoad: () => setLoadedSrc(src),
    onError: () => setFailedSrc(src),
  };
}
