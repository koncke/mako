'use client';

// =============================================================================
// SelectorVista — «Kanban · Lista»: los íconos JUNTOS, en un segmento
// =============================================================================
// Martín (21/10/2026), textual: «Los íconos de "tablero y lista" deberían estar como juntos en una
// sección, y el placeholder del "tablero" debe ser "kanban"... Esto en todos lados».
//
// UNA pieza para todos los tableros (el CRM, Clientes y el Plan). Hasta el 21/10 había tres: el CRM con
// dos píldoras sueltas (`.tk-ptab`) que decían «Tablero», Clientes con su `.bc-toggle` y el Plan con un
// `VistaToggle` propio que decía «Ver en tarjetas». Tres controles para la misma pregunta («¿cómo miro
// esto?») es lo que hace que se vean distintos al primer ajuste de uno.
//
// Sólo el ícono, con el nombre en el tooltip de la casa y en el `aria-label` (20/10/2026: «"Tablero y
// lista" solo con íconos»). El nombre y el dibujo salen de ./iconos-vista.tsx.
// ⚠️ CON UNA SOLA VISTA NO SE DIBUJA: un segmento de un botón queda siempre prendido y se lee trabado.
// =============================================================================

import type { CSSProperties } from 'react';
import { Tooltip } from './Tooltip';
import { ICONO_VISTA, type VistaIcono } from './iconos-vista';

export function SelectorVista<V extends VistaIcono>({ vistas, vista, onVista, ariaLabel, style }: {
  /** Las vistas que ofrece la pantalla, en el orden en que se dibujan. */
  vistas: readonly V[];
  vista: V;
  onVista: (v: V) => void;
  /** Qué se mira: «Cómo ver los leads». */
  ariaLabel: string;
  style?: CSSProperties;
}) {
  if (vistas.length < 2) return null;
  return (
    <div role="tablist" aria-label={ariaLabel} className="mk-selector-vista"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: 'none', padding: 2, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', ...style }}>
      {vistas.map((v) => {
        const activa = v === vista;
        return (
          <Tooltip key={v} text={ICONO_VISTA[v].titulo} side="bottom">
            <button type="button" role="tab" aria-selected={activa} aria-label={ICONO_VISTA[v].titulo} onClick={() => onVista(v)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 30, padding: 0, flex: 'none',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activa ? 'var(--surface)' : 'transparent', color: activa ? 'var(--primary)' : 'var(--faint)',
                boxShadow: activa ? '0 1px 2px rgba(18,21,27,.08)' : 'none',
              }}>
              {ICONO_VISTA[v].icono}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
