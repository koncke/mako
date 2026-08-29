'use client';

// =============================================================================
// BuscadorTareas — la barra: búsqueda simple, avanzada y con MaKo
// =============================================================================
// Antes era un `<input>` suelto que buscaba en TODO siempre (título, detalle, notas,
// razones del score y checklist juntos). El dueño: «es incómodo y contraintuitivo que
// intente buscar coincidencia en un título y me salgan muchas tareas porque está leyendo
// el detalle y otras cosas».
//
// Tres modos, en la MISMA barra —no tres buscadores— porque son la misma intención con
// distinta precisión:
//
//  1. SIMPLE (default) — solo el título. Es lo que uno espera al escribir una palabra.
//  2. AVANZADA — el botón de la derecha abre los campos y elegís dónde mirar: detalle,
//     checklist, notas, razones de MaKo. Cuando hay más de un campo activo, la barra lo
//     DICE con un chip: si no, uno no entiende por qué aparecen resultados de más.
//  3. CON MaKo — describís lo que buscás en tus palabras («lo que quedó trabado por
//     Meta», «las de seguridad que nadie miró») y MaKo lee todo el tablero y elige.
//
// El `#número` se busca siempre, en cualquier modo. Escribir «#412» no es buscar texto:
// es pedir una tarea puntual.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CAMPOS, CAMPOS_POR_DEFECTO, CAMPOS_TODOS, resumenCampos, type CampoBusqueda } from '@/lib/buscar-tareas';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type ModoBusqueda = { q: string; campos: CampoBusqueda[]; ia: { pensando: boolean; ids: string[] | null; explico: string } };

export function BuscadorTareas({ q, onQ, campos, onCampos, ia, onBuscarIA, onLimpiarIA }: {
  q: string;
  onQ: (v: string) => void;
  campos: CampoBusqueda[];
  onCampos: (v: CampoBusqueda[]) => void;
  ia: ModoBusqueda['ia'];
  onBuscarIA: (texto: string) => void;
  onLimpiarIA: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click afuera. Sin esto el panel queda abierto tapando el tablero
  // y hay que volver a apretar el botón exacto para sacarlo.
  useEffect(() => {
    if (!abierto) return;
    // ⚠️ El panel vive en un PORTAL (document.body), así que NO está adentro de
    // `caja`: con `caja.contains()` a secas, el primer click sobre una casilla del
    // propio panel se lee como «afuera» y lo cierra. Se pregunta también por el panel,
    // que se marca con un data-attribute justamente para poder encontrarlo desde acá.
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (caja.current?.contains(t)) return;
      if ((t as Element)?.closest?.('[data-buscador-panel]')) return;
      setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  // DÓNDE se dibuja el panel, medido contra el VIEWPORT. Se recalcula al abrir y en
  // scroll/resize, porque la barra se mueve con la página.
  const [ancla, setAncla] = useState<{ top: number; left: number; alto: number } | null>(null);
  useEffect(() => {
    if (!abierto) { setAncla(null); return; }
    const medir = () => {
      const r = caja.current?.getBoundingClientRect();
      if (!r) return;
      // Si abajo no entra, el techo es lo que quede — con un piso para que no quede
      // una rendija inservible.
      setAncla({ top: r.bottom + 8, left: r.left, alto: Math.max(180, window.innerHeight - r.bottom - 24) });
    };
    medir();
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir); };
  }, [abierto]);

  const ampliada = campos.length > CAMPOS_POR_DEFECTO.length || !campos.includes('titulo');
  const conIA = ia.ids !== null || ia.pensando;

  const toggle = (id: CampoBusqueda) => {
    const hay = campos.includes(id);
    onCampos(hay ? campos.filter((c) => c !== id) : [...campos, id]);
  };

  return (
    <div ref={caja} style={{ position: 'relative', flex: '0 1 280px', minWidth: 150 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px 0 0',
        borderRadius: 9, border: `1px solid ${conIA ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: 'var(--surface)', transition: 'border-color .15s',
      }}>
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey && q.trim()) { e.preventDefault(); onBuscarIA(q); } }}
          placeholder={conIA ? 'Buscando con MaKo…' : 'Buscar por título…'}
          style={{ flex: 1, minWidth: 0, padding: '8px 0 8px 12px', border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }}
        />

        {/* Pedirle a MaKo. Solo aparece con algo escrito: un botón de IA siempre visible
            invita a apretarlo sin necesidad, y cada apretada es una llamada al modelo. */}
        {q.trim() && !conIA && (
          <button type="button" onClick={() => onBuscarIA(q)} title="Buscar con MaKo (Shift+Enter)"
            style={{ ...mini, color: 'var(--accent)', borderColor: 'var(--accent-weak, var(--border))' }}>✦</button>
        )}
        {conIA && (
          <button type="button" onClick={onLimpiarIA} title="Volver a la búsqueda normal"
            style={{ ...mini, color: 'var(--accent)' }}>{ia.pensando ? '…' : '✕'}</button>
        )}

        {/* El chevron va en SVG y no como el carácter «⌄»: ese glifo se dibuja pegado al
            techo de su caja (su baseline no está donde uno espera), así que por más que
            el botón centre con flex, el ícono se ve corrido hacia arriba. Un path se
            centra de verdad, y de paso gira cuando el menú está abierto. */}
        <button type="button" onClick={() => setAbierto((v) => !v)} title="Dónde buscar" aria-label="Dónde buscar" aria-expanded={abierto}
          style={{ ...mini, color: ampliada ? 'var(--primary)' : 'var(--faint)', borderColor: ampliada ? 'var(--primary)' : 'transparent' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ display: 'block', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
      </div>

      {/* El chip dice DÓNDE se está buscando. Sin esto, sumar «detalle» hace aparecer
          treinta resultados y parece que el buscador se rompió. */}
      {(ampliada || conIA) && (
        <div style={{ position: 'absolute', top: '100%', left: 2, marginTop: 3, fontSize: 10.5, fontFamily: MONO, letterSpacing: '.04em', color: conIA ? 'var(--accent)' : 'var(--primary)', whiteSpace: 'nowrap' }}>
          {conIA ? (ia.pensando ? 'MaKo está leyendo el tablero…' : `MaKo eligió ${ia.ids?.length ?? 0}`) : resumenCampos(campos)}
        </div>
      )}

      {/* EL MENÚ SE CORTABA Y NO HABÍA CÓMO LLEGAR A LO DE ABAJO.
          Dos causas encimadas, y hacían falta las dos correcciones:
          · No tenía techo ni scroll propio, así que crecía hasta donde le diera.
          · Vive dentro de un <main> con `overflow: hidden` y `height: 100vh`
            (BoardShell), que recorta a cualquier hijo absoluto que se pase — y con
            el header arriba, el espacio real es bastante menos que la pantalla.
          El techo se calcula contra el viewport (100vh menos lo que ocupa el header)
          para que el menú TERMINE antes del recorte y el scroll quede adentro, que es
          donde el usuario lo puede usar. */}
      {abierto && ancla && createPortal(
        <div data-buscador-panel style={{
          position: 'fixed', top: ancla.top, left: ancla.left, zIndex: 2000, width: 280,
          maxHeight: Math.min(ancla.alto, 460), overflowY: 'auto', overscrollBehavior: 'contain',
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,.16)', padding: 12, fontFamily: SANS,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, marginBottom: 8 }}>
            Dónde buscar
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CAMPOS.map((c) => {
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
            <button type="button" onClick={() => onCampos(CAMPOS_POR_DEFECTO)} style={atajo}>Solo el título</button>
            <button type="button" onClick={() => onCampos(CAMPOS_TODOS)} style={atajo}>Todos</button>
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>
            ¿No sabes en qué campo está? Escribe lo que buscas con tus palabras y toca <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✦</span> — MaKo lee el tablero entero y elige.
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const mini: CSSProperties = {
  width: 26, height: 26, flex: 'none', borderRadius: 7, border: '1px solid transparent',
  background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS,
};

const atajo: CSSProperties = {
  flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12, fontFamily: SANS,
};
