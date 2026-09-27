'use client';

// =============================================================================
// DatosSinMarcarCard — el aviso rojo unificado de "Datos sin marcar"
// =============================================================================
// Mismo bloque en la ficha (todas las tabs) y en el modal. El botón "Solucionar"
// vive DENTRO del cuadro, es cuadrado y con emoji para que se vea clickeable.

import type { CSSProperties } from 'react';
import type { Step } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
// ⚠️ ÁMBAR, NO ROJO. Los datos que faltan son algo POR HACER; el rojo es el de
// «Perdido» y el de los errores. Con el mismo color, la pantalla que más se mira
// del CRM parecía una lista de cosas rotas — y un rojo permanente se deja de ver.
const card: CSSProperties = { background: 'var(--warn-bg)', border: '1px solid var(--warn)', borderRadius: 16, padding: '18px 20px' };

export function DatosSinMarcarCard({ faltantes, onSolucionar, label = 'Solucionar', nota, ignorado = false, onReactivar }: {
  faltantes: Step[];
  onSolucionar: () => void;
  label?: string;
  /** Texto de ayuda opcional debajo del título. */
  nota?: string;
  /** El lead tiene los avisos ignorados en el worklist del CRM general (mig 0109). */
  ignorado?: boolean;
  /** Reactivar los avisos (vuelve al worklist). Requerido si ignorado. */
  onReactivar?: () => void;
}) {
  if (!faltantes.length) return null;
  // ⚠️ UNA LÍNEA, NO UN CARTEL. Esto vivía como un bloque de 180 px con punto
  // parpadeante, título en versalitas, una frase de ayuda, un chip por dato y un
  // botón macizo con emoji — arriba de TODAS las pestañas de la ficha, en el 98%
  // de los leads. Ocupaba la primera pantalla entera para decir algo que casi
  // nunca es urgente, y el dueño lo reportó dos veces («ese cuadro gigante…
  // debería ser MUCHO más sutil»).
  //
  // Lo que se conserva es todo lo que se podía HACER: los nombres de los datos,
  // ir a completarlos y reactivar los avisos. Lo que se fue es el peso visual —
  // el parpadeo, el relleno, el emoji y el botón de 44 px.
  const nombres = faltantes.map((f) => f.label).join(' · ');
  return (
    <section style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)',
      background: 'var(--surface-2)', fontFamily: SANS }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--warn)', flex: 'none' }} />
      <span style={{ fontSize: 12.5, color: 'var(--dim)', minWidth: 0, lineHeight: 1.45 }}>
        <b style={{ color: 'var(--ink)', fontWeight: 650 }}>
          {faltantes.length} {faltantes.length === 1 ? 'dato sin marcar' : 'datos sin marcar'}
        </b>
        {ignorado && <span style={{ color: 'var(--faint)' }}> · ignorados</span>}
        {' — '}
        {/* Los nombres van en el MISMO renglón y no como chips: son una
            enumeración, y una fila de pastillas pesa más que la frase entera. */}
        <span title={nombres}>{nombres}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }} />
      <button type="button" onClick={onSolucionar}
        style={{ flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 650, color: 'var(--primary)', fontFamily: SANS }}>
        {label}
      </button>
      {ignorado && onReactivar && (
        <button type="button" onClick={onReactivar}
          style={{ flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', fontFamily: SANS }}>
          Reactivar avisos
        </button>
      )}
    </section>
  );
}
