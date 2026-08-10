'use client';

// =============================================================================
// BuscadorCerebro — la barra del mapa: simple, avanzada y con MaKo
// =============================================================================
// Es la misma barra que la del tablero (app/plan/board/BuscadorTareas.tsx), portada al
// mapa. Se porta y no se reusa tal cual por una razón concreta: aquella recibe y devuelve
// `CampoBusqueda` de una TAREA, y acá los campos son los de un NODO. Lo que sí se
// comparte es lo que importa — el matcheo sale de `coincide` (lib/buscar-tareas.ts), así
// que las dos búsquedas se comportan igual ante las mismas palabras.
//
// Los tres modos, en la MISMA barra, porque son la misma intención con distinta precisión:
//   1. SIMPLE (default) — solo el nombre, que es lo que se ve dibujado en el mapa.
//   2. AVANZADA — la flechita abre los campos: el contenido, de dónde salió, el área.
//   3. CON MaKo — se describe lo que se busca con palabras propias y MaKo lee el mapa
//      entero y elige. El ✦ aparece SOLO con algo escrito: un botón de IA siempre visible
//      invita a apretarlo sin necesidad, y cada apretada es una llamada al modelo.
//
// ⚠️ DOS TRAMPAS DEL LIENZO que no tiene la barra del tablero:
//   · el marco del grafo lleva `overflow: hidden`, así que un panel `absolute` se recorta;
//   · el lienzo puede entrar en PANTALLA COMPLETA con la Fullscreen API, y ahí todo lo
//     que esté fuera de ese subárbol deja de pintarse — incluido un portal a
//     `document.body`. El menú se abre, existe, responde al teclado y no se ve.
// Por eso el portal es parametrizable: el mismo problema que ya obligó a agregarle
// `portalTo` al Dropdown de la casa.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  CAMPOS_CEREBRO, CAMPOS_CEREBRO_DEFECTO, CAMPOS_CEREBRO_TODOS,
  resumenCamposCerebro, type CampoCerebro,
} from '@/lib/buscar-cerebro';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type EstadoIA = { pensando: boolean; ids: string[] | null; explico: string };

export function BuscadorCerebro({ q, onQ, campos, onCampos, ia, onBuscarIA, onLimpiarIA, resultados, total, portalTo }: {
  q: string;
  onQ: (v: string) => void;
  campos: CampoCerebro[];
  onCampos: (v: CampoCerebro[]) => void;
  ia: EstadoIA;
  onBuscarIA: (texto: string) => void;
  onLimpiarIA: () => void;
  /** Cuántos nodos matchean ahora mismo. Va al lado del campo: sin el número, buscar en
   *  «el contenido» hace aparecer resultados de más y parece que se rompió. */
  resultados: number;
  total: number;
  portalTo?: HTMLElement | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const [ancla, setAncla] = useState<{ top: number; left: number; alto: number } | null>(null);

  useEffect(() => {
    if (!abierto) return;
    // ⚠️ El panel vive en un PORTAL, así que NO está adentro de `caja`: con
    // `caja.contains()` a secas, el primer click sobre una casilla del propio panel se
    // lee como «afuera» y lo cierra. Se pregunta también por el panel, que se marca con
    // un data-attribute justamente para poder encontrarlo desde acá.
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (caja.current?.contains(t)) return;
      if ((t as Element)?.closest?.('[data-buscador-cerebro]')) return;
      setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const r = caja.current?.getBoundingClientRect();
      if (!r) return;
      setAncla({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 300), alto: window.innerHeight - r.bottom - 24 });
    };
    medir();
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir); };
  }, [abierto]);

  const ampliada = campos.length > CAMPOS_CEREBRO_DEFECTO.length || !campos.includes('nombre');
  const conIA = ia.ids !== null || ia.pensando;
  const hayTexto = q.trim() !== '';

  const toggle = (id: CampoCerebro) => {
    onCampos(campos.includes(id) ? campos.filter((c) => c !== id) : [...campos, id]);
  };

  return (
    <div ref={caja} style={{ position: 'relative', flex: '0 1 260px', minWidth: 150 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, padding: '0 3px 0 0',
        borderRadius: 9, border: `1px solid ${conIA ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: 'var(--surface-2)', transition: 'border-color .15s',
      }}>
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); onQ(''); onLimpiarIA(); return; }
            if (e.key === 'Enter' && e.shiftKey && hayTexto) { e.preventDefault(); onBuscarIA(q); }
          }}
          placeholder={conIA ? 'Buscando con MaKo…' : 'Buscar un dato'}
          aria-label="Buscar un dato en el mapa"
          style={{ flex: 1, minWidth: 0, height: 28, padding: '0 0 0 10px', border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 12.5, outline: 'none', fontFamily: SANS }}
        />

        {hayTexto && !conIA && (
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: resultados ? 'var(--dim)' : 'var(--warn)', whiteSpace: 'nowrap', paddingRight: 2 }}>
            {resultados === 0 ? 'nada' : `${resultados}/${total}`}
          </span>
        )}

        {/* Pedirle a MaKo. Solo con algo escrito, y es lo que el dueño pidió textual: «al
            escribir algo recién ahí sale la búsqueda por IA». */}
        {hayTexto && !conIA && (
          <button type="button" onClick={() => onBuscarIA(q)} title="Buscar con MaKo (Shift+Enter)" aria-label="Buscar con MaKo"
            style={{ ...mini, color: 'var(--accent)' }}>✦</button>
        )}
        {conIA && (
          <button type="button" onClick={onLimpiarIA} title="Volver a la búsqueda normal" aria-label="Volver a la búsqueda normal"
            style={{ ...mini, color: 'var(--accent)' }}>{ia.pensando ? '…' : '✕'}</button>
        )}

        {/* La flechita va en SVG y no como el carácter «⌄»: ese glifo se dibuja pegado al
            techo de su caja, así que por más que el botón centre con flex se ve corrido
            hacia arriba. Un path se centra de verdad, y de paso gira al abrir. */}
        <button type="button" onClick={() => setAbierto((v) => !v)} title="Dónde buscar" aria-label="Dónde buscar" aria-expanded={abierto}
          style={{ ...mini, color: ampliada ? 'var(--accent)' : 'var(--dim)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ display: 'block', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
      </div>

      {(ampliada || conIA) && (
        <div style={{ position: 'absolute', top: '100%', left: 2, marginTop: 3, fontSize: 10, fontFamily: MONO, letterSpacing: '.04em', color: conIA ? 'var(--accent)' : 'var(--dim)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {conIA ? (ia.pensando ? 'MaKo está leyendo tu mapa…' : `MaKo eligió ${ia.ids?.length ?? 0}`) : resumenCamposCerebro(campos)}
        </div>
      )}

      {abierto && ancla && createPortal(
        <div data-buscador-cerebro style={{
          position: 'fixed', top: ancla.top, left: ancla.left, zIndex: 2000, width: 288,
          maxHeight: Math.min(ancla.alto, 440), overflowY: 'auto', overscrollBehavior: 'contain',
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,.22)', padding: 12, fontFamily: SANS,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, marginBottom: 8 }}>
            Dónde buscar
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CAMPOS_CEREBRO.map((c) => {
              const on = campos.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 8, border: 'none', background: on ? 'var(--primary-bg)' : 'transparent', cursor: 'pointer', fontFamily: SANS }}>
                  <span style={{ width: 15, height: 15, marginTop: 1, flex: 'none', borderRadius: 4, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: on ? 650 : 500, color: on ? 'var(--primary)' : 'var(--ink)' }}>{c.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 1, lineHeight: 1.35 }}>{c.ayuda}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => onCampos(CAMPOS_CEREBRO_DEFECTO)} style={atajo}>Solo el nombre</button>
            <button type="button" onClick={() => onCampos(CAMPOS_CEREBRO_TODOS)} style={atajo}>Todo</button>
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>
            ¿No sabes en qué campo está? Escribe lo que buscas con tus palabras y toca <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✦</span> — MaKo lee el mapa entero y elige.
          </div>
        </div>,
        portalTo ?? document.body,
      )}
    </div>
  );
}

const mini: CSSProperties = {
  width: 24, height: 24, flex: 'none', borderRadius: 7, border: '1px solid transparent',
  background: 'transparent', cursor: 'pointer', fontSize: 12, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS,
};

const atajo: CSSProperties = {
  flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12, fontFamily: SANS,
};
