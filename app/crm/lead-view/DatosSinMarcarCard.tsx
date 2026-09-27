'use client';

// =============================================================================
// DatosSinMarcarCard — el aviso de «datos sin marcar» de la ficha
// =============================================================================
// Mismo aviso en la ficha (todas las tabs) y en el modal.
//
// ⚠️ NO ES UNA TARJETA. NI SIQUIERA UNA CAJA. Pedido tres veces, y la tercera con
// todas las letras: «sigue siendo una tarjeta enorme… que no sea una tarjeta
// siquiera, solo un pequeño aviso» (27/09/2026).
//
// Las dos versiones anteriores fueron:
//   1. Un bloque ámbar de ~180 px: punto parpadeante, título en versalitas, una
//      frase de ayuda, un chip por dato y un botón macizo con emoji.
//   2. Una fila con fondo y borde… que con 6 datos volvía a ocupar tres renglones.
//      `flexWrap: 'wrap'` + una enumeración larga = el texto baja a dos líneas y el
//      espaciador elástico empuja «Solucionar» a una tercera. Con caja alrededor,
//      eso se ve exactamente igual que la tarjeta que se venía de sacar.
//
// Lo que lo cierra es la regla de la casa para lo que no entra (AGENTS.md, «si algo
// no entra, declará quién CEDE»): fila en `nowrap`, lo que menos informa con
// `flex: 0 1 auto` + `ellipsis`, y lo que no puede faltar con `flex: none`. Así
// mide UN renglón con 1 dato y con 9, en cualquier ancho y con cualquier zoom —
// que es lo que una versión con `wrap` no puede prometer.
//
// Lo que se conserva es todo lo que se podía HACER: los nombres de los datos (los
// que entren, y el resto en el `title`), ir a completarlos y reactivar los avisos.
// Lo que se fue es el peso visual entero: el parpadeo, el fondo, el borde, el
// relleno, el emoji y el botón.

import type { CSSProperties } from 'react';
import type { Step } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";

const accion: CSSProperties = {
  flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 12.5, fontWeight: 650, fontFamily: SANS,
};

export function DatosSinMarcarCard({ faltantes, onSolucionar, label = 'Solucionar', ignorado = false, onReactivar }: {
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
  return (
    <div
      // El `title` lleva la lista ENTERA: lo que el renglón recorta no se pierde,
      // se consulta. Va en el contenedor y no en el <span> para que el hover
      // funcione también sobre el conteo.
      title={nombres}
      style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'nowrap', minWidth: 0, fontFamily: SANS, fontSize: 12.5, lineHeight: 1.5 }}
    >
      <span aria-hidden style={{ flex: 'none', alignSelf: 'center', width: 6, height: 6, borderRadius: 999, background: 'var(--warn)' }} />
      {/* El conteo no cede: es el dato. */}
      <span style={{ flex: 'none', color: 'var(--ink)', fontWeight: 650 }}>
        {faltantes.length} {faltantes.length === 1 ? 'dato sin marcar' : 'datos sin marcar'}
      </span>
      {ignorado && <span style={{ flex: 'none', color: 'var(--faint)' }}>· ignorados</span>}
      {/* Los nombres SÍ ceden: son la enumeración, y el título ya dijo cuántos son. */}
      <span style={{ flex: '0 1 auto', minWidth: 0, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nombres}
      </span>
      <span style={{ flex: 1, minWidth: 8 }} />
      <button type="button" onClick={onSolucionar} style={{ ...accion, color: 'var(--primary)' }}>
        {label}
      </button>
      {ignorado && onReactivar && (
        <button type="button" onClick={onReactivar} style={{ ...accion, color: 'var(--dim)', fontWeight: 600 }}>
          Reactivar
        </button>
      )}
    </div>
  );
}
