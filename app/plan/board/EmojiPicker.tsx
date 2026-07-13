'use client';

// EmojiPickerMini — botón que abre el selector de emojis estilo WhatsApp (todos
// los emojis, con pestañas y búsqueda) en un popover. Para elegir el emoji de un
// proyecto/categoría. Cierra al elegir, con Escape o click afuera.

import { useEffect, useRef, useState } from 'react';
import { EmojiPicker } from '../../whatsapp/EmojiPicker';

export function EmojiPickerMini({ value, onPick }: { value: string; onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    // capture + stopImmediatePropagation: el Escape cierra SOLO el picker, no el modal contenedor.
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc, true);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc, true); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Elegir emoji" aria-expanded={open}
        style={{ width: 36, height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>{value || '🏷'}</button>
      {open && (
        <div style={{ position: 'absolute', top: '112%', left: 0, zIndex: 1000 }}>
          <EmojiPicker onPick={(em) => { onPick(em); setOpen(false); }} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
