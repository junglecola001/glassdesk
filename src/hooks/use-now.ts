import { useEffect, useState } from 'react';

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number | undefined;
    const update = () => setNow(new Date());
    const start = () => {
      if (timer !== undefined) window.clearInterval(timer);
      update();
      timer = window.setInterval(update, intervalMs);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs]);

  return now;
}
