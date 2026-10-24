import { useCallback, useRef, useSyncExternalStore } from 'react';

export interface Store<T extends object> {
  getState: () => T;
  setState: (patch: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T extends object>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T extends object, S>(
  store: Store<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cacheRef = useRef<{ state: T; value: S } | null>(null);

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const cached = cacheRef.current;
    if (cached && cached.state === state) return cached.value;
    const next = selectorRef.current(state);
    if (cached && isEqual(cached.value, next)) {
      cacheRef.current = { state, value: cached.value };
      return cached.value;
    }
    cacheRef.current = { state, value: next };
    return next;
  }, [store, isEqual]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useStoreState<T extends object>(store: Store<T>): T {
  return useStore(store, (state) => state);
}
