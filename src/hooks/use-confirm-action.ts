import { useEffect, useRef, useState } from 'react';

export function useConfirmAction(onConfirm: () => void, resetMs = 2800) {
  const [armed, setArmed] = useState(false);
  const callbackRef = useRef(onConfirm);
  callbackRef.current = onConfirm;

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), resetMs);
    return () => window.clearTimeout(timer);
  }, [armed, resetMs]);

  return {
    armed,
    trigger: () => {
      if (armed) {
        callbackRef.current();
        setArmed(false);
      } else {
        setArmed(true);
      }
    },
    reset: () => setArmed(false),
  };
}
