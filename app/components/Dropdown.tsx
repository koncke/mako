'use client';

// =============================================================================
// Dropdown — desplegable estilizado (reemplaza el <select> nativo plano)
// =============================================================================
// Botón + menú flotante con ítems de hasta dos líneas (título + subtítulo) y un
// punto de color opcional. Cierra por click afuera o Escape. Pensado para todos
// los desplegables del app (filtros, "Mover a…", tipo/banda del funnel, etc.).

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

export type DropdownOption = { value: string; label: string; sub?: string; color?: string; disabled?: boolean };

export function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar…',
  width,
  align = 'left',
  buttonStyle,
  resetAfterSelect = false,
  ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  align?: 'left' | 'right';
  buttonStyle?: CSSProperties;
  /** Para selects-acción (ej. "Mover a…"): no refleja la selección, vuelve al placeholder. */
  resetAfterSelect?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Abre hacia arriba si no hay espacio suficiente abajo (no empuja el layout).
  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      setDropUp(below < 300 && r.top > below);
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const selected = resetAfterSelect ? undefined : options.find((o) => o.value === value);

  const btn: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: selected ? 'var(--ink)' : 'var(--dim)',
    fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: 'none',
    width: width ?? 'auto', ...buttonStyle,
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: width ?? 'auto' }}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={toggle} style={btn}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {selected?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flex: 'none' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.label : placeholder}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 10, color: 'var(--faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && (
        <div role="listbox" style={{ position: 'absolute', top: dropUp ? undefined : 'calc(100% + 6px)', bottom: dropUp ? 'calc(100% + 6px)' : undefined, left: align === 'left' ? 0 : undefined, right: align === 'right' ? 0 : undefined, zIndex: 200, minWidth: '100%', width: 'max-content', maxWidth: 360, maxHeight: 340, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(23,21,17,.22)', padding: 6 }}>
          {options.map((o) => {
            const on = !resetAfterSelect && o.value === value;
            return (
              <button key={o.value} type="button" disabled={o.disabled}
                onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); } }}
                onMouseEnter={(e) => { if (!o.disabled && !on) e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: 'none', cursor: o.disabled ? 'default' : 'pointer', background: on ? 'var(--surface-2)' : 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, opacity: o.disabled ? 0.45 : 1 }}>
                {o.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color, flex: 'none' }} />}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                  {o.sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1, lineHeight: 1.3 }}>{o.sub}</span>}
                </span>
                {on && <span style={{ flex: 'none', color: 'var(--accent)', fontSize: 13 }}>✓</span>}
              </button>
            );
          })}
          {options.length === 0 && <div style={{ padding: '9px 11px', fontSize: 13, color: 'var(--faint)' }}>Sin opciones</div>}
        </div>
      )}
    </div>
  );
}
