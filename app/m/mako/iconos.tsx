// =============================================================================
// /m/mako — los íconos del composer que el set de la casa todavía no tiene
// =============================================================================
// Mismo trazo que `Icon` (app/_components/icons.tsx): 24×24, stroke 1.85, currentColor.
// ⚠️ Son seis y deberían vivir en el set (`PATHS` de icons.tsx): ese archivo no era de
// esta tanda. Cuando se muden, esto se borra y los llamados pasan a `<Icon name=…>`.
// Lo que el set ya tiene (mic, trash, x, chats, mako) se usa desde ahí.
// =============================================================================

import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  mas: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  enviar: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  camara: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
  foto: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9.5" r="1.8" /><path d="M21 16l-5-5-9 9" /></>,
  archivo: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
  candado: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export function IconoM({ nombre, size = 22 }: { nombre: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
      {PATHS[nombre] ?? null}
    </svg>
  );
}
