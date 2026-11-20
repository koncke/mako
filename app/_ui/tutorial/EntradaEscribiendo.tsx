'use client';
// =============================================================================
// LA ENTRADA DE UN CHAT CON VIDEO: LA PANTALLA OSCURA Y MaKo ESCRIBIENDO (20/11/2026, V5; las reglas en ./entrada.ts)
// =============================================================================
// La maqueta (cuerpo.html, el paso «escribe»: «todo oscuro menos MaKo escribiendo»; b-of-entra: «Offer Coach abre como el recorrido:
// la pantalla se oscurece, escribe y manda el video»). Así abren los coaches la primera vez, y así abre cada día del reto:
//   const fase = useEntrada('offer-coach', laPrimeraVez);
//   {fase === 'escribe' ? <EntradaEscribiendo foto={<Muneco … />} quien="Offer Coach" /> : <el mensaje con <VideoDelMomento dalePlay />>}
// Lo oscuro es la sombra de un hueco sobre la fila de los tres puntitos (como el motor), en un portal: el panel vive dentro de los
// contextos de apilado del layout, y ahí un velo no tapa la lista de chats. La fila de verdad se ve por el hueco: no hay copia.
// Entra con el barrido del sol y la luna (./iris.ts), salvo con menos movimiento.
// =============================================================================
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MS_ESCRIBE_ENTRADA, anotarEntrada, yaEntro } from './entrada';
import { barrer } from './iris';

const menosMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * 'escribe' la primera vez que `activa` se prende para esa clave (en esta página), durante MS_ESCRIBE_ENTRADA; si no, 'listo'.
 * `activa`: el chat está a la vista y abre con su video (la primera vez: el chat vacío).
 */
export function useEntrada(clave: string, activa: boolean): 'escribe' | 'listo' {
  const [escribe, setEscribe] = useState(false);
  useLayoutEffect(() => {
    if (!activa || yaEntro(clave)) return;
    anotarEntrada(clave);
    // En un efecto de layout: el mensaje con el video no llega a pintarse antes de los tres puntitos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEscribe(true);
    const t = window.setTimeout(() => setEscribe(false), MS_ESCRIBE_ENTRADA);
    // Si el chat se esconde a mitad, la entrada termina (ya cuenta como vista).
    return () => { window.clearTimeout(t); setEscribe(false); };
  }, [activa, clave]);
  return escribe ? 'escribe' : 'listo';
}

type Caja = { x: number; y: number; ancho: number; alto: number };
const AIRE = 6;

/** La fila de quien escribe (su foto y los tres puntitos), con todo lo demás oscuro. */
export function EntradaEscribiendo({ foto, quien = 'MaKo' }: { foto: ReactNode; quien?: string }) {
  const fila = useRef<HTMLDivElement>(null);
  const hueco = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<Caja | null>(null);
  useLayoutEffect(() => {
    const el = fila.current;
    if (!el) return;
    // La foto y los tres puntitos, nada más: la fila (y su cuerpo) se estira al ancho del chat.
    const medir = () => {
      const partes = [el.querySelector('.co-el')?.firstElementChild, el.querySelector('.mk-entrada__puntos')].filter((x): x is Element => !!x);
      const rs = (partes.length ? partes : [el]).map((x) => x.getBoundingClientRect());
      const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top));
      const x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom));
      setCaja({ x: x0 - AIRE, y: y0 - AIRE, ancho: x1 - x0 + AIRE * 2, alto: y1 - y0 + AIRE * 2 });
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(document.documentElement);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  const hayCaja = caja != null;
  useLayoutEffect(() => {
    const nodo = hueco.current;
    if (!hayCaja || !nodo || menosMovimiento()) return;
    return barrer(nodo);
  }, [hayCaja]);

  return (
    <>
      <style>{CSS}</style>
      <div ref={fila} className="co-el-wa mk-entrada__fila" data-entrada="escribe">
        <div className="co-el">{foto}
          <div className="co-el__cuerpo"><span role="status" aria-label={`${quien} está escribiendo`} className="mk-entrada__puntos"><i /><i /><i /></span></div>
        </div>
      </div>
      {caja && typeof document !== 'undefined' && createPortal(
        <div className="mk-entrada" aria-hidden="true">
          <style>{CSS}</style>
          <div ref={hueco} className="mk-entrada__hueco" style={{ left: caja.x, top: caja.y, width: caja.ancho, height: caja.alto }} />
        </div>,
        document.body,
      )}
    </>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md). El velo, el del motor (Recorrido.tsx, --rec-velo).
const CSS = `
.mk-entrada { position: fixed; inset: 0; z-index: 650; }
.mk-entrada__hueco { position: fixed; border-radius: 22px; pointer-events: none; box-shadow: 0 0 0 200vmax color-mix(in srgb, var(--sidebar) 66%, transparent); }
.mk-entrada__puntos { display: inline-flex; align-items: center; gap: 4px; padding: 6px 2px; color: var(--dim); }
.mk-entrada__puntos i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: mk-entrada-puntos 1.2s ease-in-out infinite; }
.mk-entrada__puntos i:nth-child(2) { animation-delay: .15s; }
.mk-entrada__puntos i:nth-child(3) { animation-delay: .3s; }
@keyframes mk-entrada-puntos { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .mk-entrada__puntos i { animation: none; } }
`;
