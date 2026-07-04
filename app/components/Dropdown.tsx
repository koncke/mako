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

// Botón de una opción del menú (compartido por la lista plana y las columnas).
// En columnas el `sub` se omite: el título del grupo ya da ese contexto.
function renderOption(
  o: DropdownOption,
  value: string,
  resetAfterSelect: boolean,
  onChange: (v: string) => void,
  close: () => void,
  enColumna: boolean,
) {
  const on = !resetAfterSelect && o.value === value;
  return (
    <button key={o.value} type="button" disabled={o.disabled}
      onClick={() => { if (!o.disabled) { onChange(o.value); close(); } }}
      onMouseEnter={(e) => { if (!o.disabled && !on) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: 'none', cursor: o.disabled ? 'default' : 'pointer', background: on ? 'var(--surface-2)' : 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, opacity: o.disabled ? 0.45 : 1 }}>
      {o.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color, flex: 'none' }} />}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
        {!enColumna && o.sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1, lineHeight: 1.3 }}>{o.sub}</span>}
      </span>
      {on && <span style={{ flex: 'none', color: 'var(--primary)', fontSize: 13 }}>✓</span>}
    </button>
  );
}

export type DropdownOption = { value: string; label: string; sub?: string; color?: string; disabled?: boolean };
/** Grupo con título para menús en columnas (ver prop `columns`). */
export type DropdownGroup = { title: string; options: DropdownOption[] };

type MenuPos = { top?: number; bottom?: number; left?: number; right?: number; width: number };

export function Dropdown({
  value,
  options,
  columns,
  onChange,
  placeholder = 'Seleccionar…',
  width,
  align = 'left',
  buttonStyle,
  resetAfterSelect = false,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  options?: DropdownOption[];
  /**
   * Menú en columnas lado a lado (evita el scroll de listas largas): cada
   * columna es una lista de grupos {título, opciones}. Si se pasa, `options`
   * se ignora. En pantallas angostas las columnas hacen wrap a una sola.
   */
  columns?: DropdownGroup[][];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  align?: 'left' | 'right';
  buttonStyle?: CSSProperties;
  /** Para selects-acción (ej. "Mover a…"): no refleja la selección, vuelve al placeholder. */
  resetAfterSelect?: boolean;
  ariaLabel?: string;
  /** Deshabilita TODO el desplegable (no se puede abrir): p.ej. mientras cargan las opciones. */
  disabled?: boolean;
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
    const vertical = up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 };
    // Con columnas el ancho del menú es conocido → clampear al viewport para
    // que en pantallas angostas no se salga por el lado del anclaje.
    if (columns) {
      const w = Math.min(500, window.innerWidth - 24);
      const left = Math.min(Math.max(12, align === 'right' ? r.right - w : r.left), window.innerWidth - 12 - w);
      setPos({ width: r.width, ...vertical, left });
      return;
    }
    setPos({
      width: r.width,
      ...vertical,
      ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }),
    });
  };
  const toggle = () => {
    if (disabled) return;
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

  const flat = columns ? columns.flat().flatMap((g) => g.options) : (options ?? []);
  const selected = resetAfterSelect ? undefined : flat.find((o) => o.value === value);

  const btn: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: selected ? 'var(--ink)' : 'var(--dim)',
    fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
    width: width ?? 'auto', opacity: disabled ? 0.6 : 1, ...buttonStyle,
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: width ?? 'auto' }}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-disabled={disabled} disabled={disabled} onClick={toggle} style={btn}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {selected?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flex: 'none' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.label : placeholder}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 10, color: 'var(--faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="listbox" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, zIndex: 1000, minWidth: pos.width, width: columns ? 'min(500px, calc(100vw - 24px))' : 'max-content', maxWidth: columns ? undefined : 360, maxHeight: columns ? 'min(480px, calc(100dvh - 40px))' : 340, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.22)', padding: 6 }}>
          {columns ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {columns.map((col, ci) => (
                <div key={ci} style={{ flex: '1 1 190px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {col.map((g) => (
                    <div key={g.title}>
                      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '8px 11px 4px' }}>{g.title}</div>
                      {g.options.map((o) => renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), true))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              {(options ?? []).map((o) => renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), false))}
              {(options ?? []).length === 0 && <div style={{ padding: '9px 11px', fontSize: 13, color: 'var(--faint)' }}>Sin opciones</div>}
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
