'use client';

// EmojiPickerMini — botón que abre un grid de emojis en popover (tema claro).
// Para elegir el emoji de un proyecto/categoría del board. Cierra al elegir,
// con Escape o click afuera.

import { useEffect, useRef, useState } from 'react';

const PROJECT_EMOJIS = [
  // Growth · performance · ventas
  '📈', '📊', '💹', '🚀', '🎯', '💰', '🛒', '🏷️', '💳', '🤝',
  // Canales · mensajería · social
  '💬', '📣', '📢', '📧', '✉️', '📱', '📲', '🔔', '🌐', '📡',
  // Contenido · creativo · diseño
  '✨', '🎨', '🖌️', '🎬', '🎥', '📸', '📷', '✏️', '📝', '🎙️',
  // Analytics · datos · research
  '🔍', '🔎', '🧪', '🧫', '📐', '📉', '🧭', '🗂️', '📋', '🗃️',
  // Producto · plataforma · técnico
  '🧱', '⚙️', '🛠️', '🔧', '🧩', '🤖', '💡', '🔌', '🗄️', '🔒',
  // Estado · gestión · misc
  '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⭐', '🔥', '⚡', '📌',
];

export function EmojiPickerMini({ value, onPick }: { value: string; onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Elegir emoji" aria-expanded={open}
        style={{ width: 36, height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>{value || '🏷'}</button>
      {open && (
        <div role="dialog" aria-label="Selector de emojis"
          style={{ position: 'absolute', top: '112%', left: 0, zIndex: 1000, width: 300, padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.22)', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2 }}>
          {PROJECT_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { onPick(e); setOpen(false); }} aria-label={`Emoji ${e}`}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = e === value ? 'var(--surface-2)' : 'transparent')}
              style={{ aspectRatio: '1 / 1', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0, background: e === value ? 'var(--surface-2)' : 'transparent' }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
