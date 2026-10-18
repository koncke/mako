'use client';

// =============================================================================
// BuscadorNav — el buscador de la barra, «Ctrl K» (17/10/2026 noche)
// =============================================================================
// Prototipo docs/prototipos/sidebar-nueva-1710.html (Notion, Attio y Linear lo ponen arriba con Ctrl K): encuentra las
// tabs, las pantallas de ADENTRO de una tab (Editor, Strategy, Reels…, que en la barra no tienen fila) y los ajustes del
// menú de la foto, y entiende los nombres viejos: «General» o «home» llevan al Dashboard (Focus), «Customer Success» a
// Clients. Busca entre lo que ESTA persona ve (la barra le pasa la lista ya filtrada por rol y capa).
//
// ⚠️ SIN MODAL (regla de Martín, 17/10/2026: «nada de modales nuevos»): es un campo de la barra y su lista cuelga debajo,
// en un portal como los desplegables. Escape la cierra; Enter va al primero (o al marcado con las flechas).

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from './icons';
import { buscarDestinos, type Destino } from '@/lib/buscador-nav';

// La regla (qué encuentra y los alias) vive en lib/buscador-nav.ts: sin React, la fija un test.
export type { Destino };

export function BuscadorNav({ destinos, abierta, onAbrir }: {
  destinos: readonly Destino[];
  /** ¿La barra está abierta? Plegada, el buscador es un ícono que la abre. */
  abierta: boolean;
  onAbrir: () => void;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState('');
  const [marcado, setMarcado] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const resultados = useMemo(() => buscarDestinos(q, destinos), [q, destinos]);

  // Ctrl K / Cmd K desde cualquier pantalla. La pantalla que tiene SU Ctrl K gana (el inicio del Web Generator enfoca
  // su propia búsqueda, app/web-generator/Inicio.tsx): escucha en `document`, que corre antes que `window`, y lo marca
  // con preventDefault; acá eso se respeta.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onAbrir();
        setTimeout(() => campo.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onAbrir]);

  const medir = () => {
    const r = campo.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 260) });
  };
  const cerrar = () => { setQ(''); setMarcado(0); setPos(null); };
  const ir = (d: Destino | undefined) => {
    if (!d) return;
    cerrar();
    campo.current?.blur();
    if (d.item.newTab) window.open(d.item.href, '_blank', 'noopener');
    else router.push(d.item.href);
  };

  if (!abierta) {
    return (
      <button type="button" className="mk-navrow" title="Search (Ctrl K)" aria-label="Search"
        onClick={() => { onAbrir(); setTimeout(() => campo.current?.focus(), 220); }}
        style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '8px 0', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}>
        <Icon name="search" size={17} />
      </button>
    );
  }

  return (
    <>
      <label className="mk-buscador" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', color: 'var(--sidebar-text)' }}>
        <Icon name="search" size={15} />
        <input ref={campo} value={q} placeholder="Search" aria-label="Search tabs and settings"
          onFocus={medir}
          onChange={(e) => { setQ(e.target.value); setMarcado(0); medir(); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { cerrar(); e.currentTarget.blur(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setMarcado((m) => Math.min(m + 1, Math.max(resultados.length - 1, 0))); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); ir(resultados[marcado] ?? resultados[0]); }
          }}
          onBlur={() => setTimeout(cerrar, 150)}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--on-sidebar)', font: 'inherit', fontSize: 'var(--fs-sm)' }} />
        <kbd style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, opacity: 0.7 }}>Ctrl K</kbd>
      </label>
      {pos && q.trim() && createPortal(
        <div id="buscador-nav" role="listbox" aria-label="Results"
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 2000, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.28)', padding: 6, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          {resultados.length === 0 && <div style={{ padding: '8px 10px', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>Nothing found</div>}
          {resultados.map((d, i) => (
            <button key={d.item.href} type="button" role="option" aria-selected={i === marcado}
              className={`mk-navrow mk-navrow--claro${i === marcado ? ' is-activo' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); ir(d); }} onMouseEnter={() => setMarcado(i)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 'var(--fs-sm)' }}>
              <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name={d.item.icon} size={16} /></span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.item.seccion ?? d.item.label}</span>
              {d.donde && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{d.donde}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
