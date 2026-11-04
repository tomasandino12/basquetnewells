import { useSyncExternalStore } from 'react';

// Desde 64rem (el corte de escritorio de layout.css) la ficha va en un panel fijo.
const ESCRITORIO = '(min-width: 64rem)';

export function useEscritorio(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const m = window.matchMedia?.(ESCRITORIO);
      m?.addEventListener('change', aviso);
      return () => m?.removeEventListener('change', aviso);
    },
    () => window.matchMedia?.(ESCRITORIO).matches ?? false,
    () => false,
  );
}
