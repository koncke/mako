'use client';

// =============================================================================
// DatosSinMarcarCard — el aviso de «datos sin marcar» de la ficha
// =============================================================================
// Mismo aviso en la ficha (todas las tabs) y en el modal. Vive en el header,
// debajo del desplegable de etapa.
//
// ⚠️ UN SOLO RENGLÓN, SIEMPRE. Es una regla, no un objetivo: «Solucionar siempre
// en 1 sola línea, si tienes que acortar la frase hazlo, pero siempre en 1 sola
// línea» (27/09/2026). Por eso `flexWrap: 'nowrap'` — esa es la garantía dura,
// que no depende de ninguna medición. Lo que las medidas deciden es el TEXTO, no
// si envuelve.
//
// ⚠️ Y LA MEDICIÓN ANTERIOR ESTABA MAL POR LA FUENTE. Se midió en una página con
// `font-family: 'Geist', system-ui, sans-serif` SIN que Geist estuviera cargada,
// así que midió system-ui: 205,8 px, que entraba en los 210 del desplegable. Con
// Geist de verdad el mismo contenido mide **214,6** y se parte en dos, que es
// exactamente lo que se reportó. Medir con otra fuente es medir otra cosa —
// `document.fonts.load(...)` + `document.fonts.ready` antes de leer un ancho.
//
// Medido el 27/09/2026 con Geist cargada, contra los 210 px del desplegable:
//
//   «6 datos sin marcar» + «Solucionar →»     214,6  ✗  (lo que se partía)
//   «6 sin marcar»       + «Solucionar →»     176,9  ✓  33 px de holgura
//   «999 sin marcar»     + «Solucionar →»     192,7  ✓  17 px con tres dígitos
//   «6 sin marcar · ignorados» + 2 acciones   312,5  ✗
//   «6 sin marcar»       + «Reactivar»        154,8  ✓
//
// De ahí sale el copy: se fue la palabra «datos» —el renglón ya está debajo de la
// etapa del lead, no hace falta decir de qué son— y en el caso ignorado queda la
// única acción que importa en ese estado. El estado se dice con el color y con el
// `title`, que no ocupan ancho.
//
// Lo que NO se puede volver a poner acá: la lista de nombres. Vive en el `title`.

import type { CSSProperties } from 'react';
import type { Step } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";

const accion: CSSProperties = {
  flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 12.5, fontWeight: 650, fontFamily: SANS, whiteSpace: 'nowrap',
};

export function DatosSinMarcarCard({ faltantes, onSolucionar, label = 'Solucionar →', ignorado = false, onReactivar }: {
  faltantes: Step[];
  onSolucionar: () => void;
  label?: string;
  /** El lead tiene los avisos ignorados en el worklist del CRM general (mig 0109). */
  ignorado?: boolean;
  /** Reactivar los avisos (vuelve al worklist). Requerido si ignorado. */
  onReactivar?: () => void;
}) {
  if (!faltantes.length) return null;
  const nombres = faltantes.map((f) => f.label).join(' · ');
  // Ignorado: apagado y con «Reactivar». Los dos botones juntos miden 312,5 px y
  // no hay forma de que entren en un renglón — y en ese estado lo que se quiere
  // es volver a verlos en el worklist, no completarlos de a uno.
  const apagado = ignorado && !!onReactivar;
  return (
    <div
      // La lista entera y el estado, a un hover y a cero píxeles de ancho.
      title={ignorado ? `Ignorados en el CRM — ${nombres}` : nombres}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', fontFamily: SANS, fontSize: 12.5, lineHeight: 1.4 }}
    >
      <span aria-hidden style={{ flex: 'none', width: 6, height: 6, borderRadius: 999, background: apagado ? 'var(--faint)' : 'var(--warn)' }} />
      <span style={{ flex: 'none', color: apagado ? 'var(--faint)' : 'var(--ink)', fontWeight: 650, whiteSpace: 'nowrap' }}>
        {faltantes.length} sin marcar
      </span>
      {apagado ? (
        <button type="button" onClick={onReactivar} style={{ ...accion, color: 'var(--dim)', fontWeight: 600 }}>
          Reactivar
        </button>
      ) : (
        <button type="button" onClick={onSolucionar} style={{ ...accion, color: 'var(--primary)' }}>
          {label}
        </button>
      )}
    </div>
  );
}
