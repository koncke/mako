'use client';

// =============================================================================
// Dropdown — desplegable estilizado (reemplaza el <select> nativo plano)
// =============================================================================
// Botón + menú flotante con ítems de hasta dos líneas (título + subtítulo) y un
// punto de color opcional. Cierra por click afuera, Escape, scroll o resize.
// El menú se renderiza en un PORTAL (position: fixed sobre document.body) para
// que NO lo recorte ningún contenedor con overflow (ej. el scroll del modal de
// detalle): antes, dentro de un modal scrolleable el menú se cortaba al abrir.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

const SANS = "'Geist', sans-serif";

export type DropdownOption = { value: string; label: string; sub?: string; color?: string; disabled?: boolean };

type MenuPos = { top?: number; bottom?: number; left?: number; right?: number; width: number };

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
  const [pos, setPos] = useState<MenuPos | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Calcula la posición fija del menú a partir del rect del botón. Abre hacia
  // arriba si abajo no hay lugar (sin empujar el layout). En coordenadas de
  // viewport porque el menú vive en un portal con position: fixed.
  const place = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 300 && r.top > below;
    setPos({
      width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }),
    });
  };
  const toggle = () => {
    if (!open) place();
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Al scrollear/redimensionar el menú fijo se despegaría del botón → cerrar.
    // PERO si el scroll ocurre DENTRO del propio menú (lista larga), NO cerrar.
    const onScrollResize = (e?: Event) => {
      if (e && e.type === 'scroll' && e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
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
      {open && pos && createPortal(
        <div ref={menuRef} role="listbox" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, zIndex: 1000, minWidth: pos.width, width: 'max-content', maxWidth: 360, maxHeight: 340, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(23,21,17,.22)', padding: 6 }}>
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
        </div>,
        document.body,
      )}
    </div>
  );
}
