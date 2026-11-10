// =============================================================================
// _ui/CursorAgente — un cursor con nombre, el de los varios mouse del reel de Web Replicate (Martín, 9/11/2026)
// =============================================================================
// Copiado del reel (docs/relevo/web-replicate-nube.md): una flecha del color del ayudante con borde oscuro y, abajo a la
// derecha, una pastilla del mismo color con un robotito oscuro y el nombre en monoespaciada. La pieza no se mueve sola:
// quien la monta le escribe `transform` por el ref (`ref`), una vez por cuadro y sin pasar por React (AGENTS.md: un
// `setState` por cuadro redibuja todo). Sirve para cualquier pantalla donde MaKo «trabaja a la vista» (Replicar hoy).
// =============================================================================

import { forwardRef, type CSSProperties } from 'react';
import type { Agente } from './enjambre';

/** El robotito de la pastilla: una cara oscura con dos ojos del color del ayudante. */
function Robot({ color }: { color: string }) {
  return (
    <svg className="ca-robot" width="13" height="11" viewBox="0 0 13 11" aria-hidden>
      <line x1="6.5" y1="0.6" x2="6.5" y2="2.2" stroke="#0B0E14" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="0.6" y="2.2" width="11.8" height="8.2" rx="2.4" fill="#0B0E14" />
      <circle cx="4.3" cy="6.3" r="1.25" fill={color} />
      <circle cx="8.7" cy="6.3" r="1.25" fill={color} />
    </svg>
  );
}

export const CursorAgente = forwardRef<HTMLDivElement, { agente: Agente; style?: CSSProperties; visible?: boolean }>(
  function CursorAgente({ agente, style, visible }, ref) {
    return (
      <div ref={ref} className="ca-cursor" data-agente={agente.id} data-ver={visible === undefined ? undefined : visible ? 'si' : 'no'} style={{ ...style, ['--ca-color' as string]: agente.color }}>
        <svg className="ca-flecha" width="14" height="19" viewBox="0 0 14 19" aria-hidden>
          <path d="M1 1 L1 15.2 L4.6 11.8 L7.2 17.6 L9.7 16.5 L7.2 10.9 L12.2 10.9 Z" fill={agente.color} stroke="#0B0E14" strokeOpacity=".7" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <span className="ca-pastilla">
          <Robot color={agente.color} />
          {agente.nombre}
        </span>
      </div>
    );
  },
);

/** La hoja de los cursores (la monta quien los usa, con su propio `<style>`). */
export const CSS_CURSOR = `
.ca-cursor { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; transition: opacity .25s ease-out; }
.ca-cursor[data-ver="no"] { opacity: 0; }
.ca-flecha { display: block; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .45)); }
.ca-pastilla { position: absolute; left: 11px; top: 15px; display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px 2px 4px; border-radius: 5px; background: var(--ca-color); color: #0B0E14; font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; font-weight: 600; line-height: 14px; white-space: nowrap; box-shadow: 0 1px 2px rgba(0, 0, 0, .35); }
.ca-robot { flex: none; display: block; }
@media (prefers-reduced-motion: reduce) { .ca-cursor { transition: none; } }
`;
