'use client';

// =============================================================================
// DatosSinMarcarCard — el aviso de «datos sin marcar» de la ficha
// =============================================================================
// Mismo aviso en la ficha (todas las tabs) y en el modal.
//
// ⚠️ SOLO EL NÚMERO Y LA SALIDA. Pedido cuatro veces, y cada vez quedaba más
// chico sin llegar a lo que se pedía:
//   1. Un bloque ámbar de ~180 px: punto parpadeante, título en versalitas, una
//      frase de ayuda, un chip por dato y un botón macizo con emoji.
//   2. Una fila con fondo y borde, que con 6 datos envolvía a tres renglones.
//   3. Un renglón sin caja, con los nombres recortados con ellipsis.
//   4. Esto: «6 datos sin marcar» y «Solucionar». Nada más.
//
// La enumeración se fue entera. Era el 80% del ancho para una lista que no se
// puede accionar desde acá —para eso está «Solucionar», que lleva justo a donde
// se completan— y que además se corta: «Documento fi…» no es un dato, es una
// palabra partida. El techo de esta superficie es el conteo, que es lo único que
// hay que decidir mirándolo: ¿lo resuelvo ahora o no?
//
// Los nombres NO se pierden: viajan en el `title`, así que están a un hover de
// distancia y a cero píxeles de la pantalla.

import type { CSSProperties } from 'react';
import type { Step } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";

const accion: CSSProperties = {
  flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 12.5, fontWeight: 650, fontFamily: SANS,
};

export function DatosSinMarcarCard({ faltantes, onSolucionar, label = 'Solucionar', ignorado = false, onReactivar, ancho = 210 }: {
  faltantes: Step[];
  onSolucionar: () => void;
  label?: string;
  /** El lead tiene los avisos ignorados en el worklist del CRM general (mig 0109). */
  ignorado?: boolean;
  /** Reactivar los avisos (vuelve al worklist). Requerido si ignorado. */
  onReactivar?: () => void;
  /**
   * El ancho del control debajo del cual vive — el desplegable de etapa.
   *
   * ⚠️ NO ES DECORATIVO: la columna del header es `flex: 'none'`, o sea que su ancho
   * es el del hijo MÁS ANCHO. Sin tope, el caso `ignorado` —que agrega «· ignorados»
   * y «Reactivar»— mide 334,9 px contra los 210 del desplegable y le come 125 px al
   * nombre del lead. Medido el 27/09/2026 en el navegador, con estos estilos.
   *
   * Con el tope, ese caso envuelve a dos renglones (210 × 43) y el normal no cambia:
   * 205,8 × 17,5, idéntico con `wrap` y con `nowrap`. O sea que envolver sale gratis
   * en el caso de todos los días y salva el raro.
   */
  ancho?: number;
}) {
  if (!faltantes.length) return null;
  return (
    <div
      // La lista entera, a un hover. Es lo único que queda del detalle, y no
      // ocupa lugar.
      title={faltantes.map((f) => f.label).join(' · ')}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', maxWidth: ancho, fontFamily: SANS, fontSize: 12.5, lineHeight: 1.4 }}
    >
      <span aria-hidden style={{ flex: 'none', width: 6, height: 6, borderRadius: 999, background: 'var(--warn)' }} />
      <span style={{ flex: 'none', color: 'var(--ink)', fontWeight: 650, whiteSpace: 'nowrap' }}>
        {faltantes.length} {faltantes.length === 1 ? 'dato sin marcar' : 'datos sin marcar'}
      </span>
      {ignorado && <span style={{ flex: 'none', color: 'var(--faint)', whiteSpace: 'nowrap' }}>· ignorados</span>}
      <button type="button" onClick={onSolucionar} style={{ ...accion, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
        {label}
      </button>
      {ignorado && onReactivar && (
        <button type="button" onClick={onReactivar} style={{ ...accion, color: 'var(--dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Reactivar
        </button>
      )}
    </div>
  );
}
