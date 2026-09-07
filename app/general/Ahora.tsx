'use client';

// =============================================================================
// La acción del día — el único elemento grande de la pantalla
// =============================================================================
// ⚠️ REHECHO EL 07/09/2026. La primera versión tenía, arriba del titular, un
// rótulo `AHORA` en monospace y una pastilla «sale de: X»; y abajo, una grilla de
// tres columnas con rótulos en monospace (DEBERÍA MOVER · QUIÉN · SE REVISA).
// Tres vetos duros del manual de la casa, los tres en el mismo bloque:
//
//   · «A kicker or eyebrow above a heading. This one is a BAN, not a default:
//      no brief earns it back. The heading carries its own weight.»
//   · «Monospace as a costume for "technical" rather than for code, data, or
//      measurement.»
//   · «Thick colored borders on cards/alerts.»  ← el filete de 4 px
//
// Los SEIS CAMPOS de la tarea #523 siguen estando —son contrato del dueño— pero
// visible queda sólo la RAZÓN, que es lo que sostiene la orden. Los otros cuatro
// se abren. Decisión del dueño, 07/09/2026: cumplir el contrato no puede
// significar convertir la pantalla de entrada en un formulario.
//
// El orden del copy sale de `clarify.md`: hecho esencial → acción → contexto.
// Por eso arriba está QUÉ HACER y no de dónde salió.
// =============================================================================

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import type { Foco } from '@/lib/focus';
import { ORIGEN_LABEL } from '@/lib/focus';

/**
 * El nivel se lee en un punto, no en un filete de 4 px ni en un fondo de color.
 * Es la cualidad «calmada» del documento de rediseño: no convertir cada señal en
 * una alarma. Lo urgente ya se distingue por ser lo único grande de la pantalla.
 */
const COLOR: Record<Foco['nivel'], string> = {
  rojo: 'var(--bad)',
  ambar: 'var(--warn-fill)',
  neutro: 'var(--good)',
};

export function Ahora({ foco }: { foco: Foco }) {
  const [abierto, setAbierto] = useState(false);
  const color = COLOR[foco.nivel];

  return (
    <section style={{ paddingBlock: 4 }}>
      <h2 style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        fontWeight: 600,
        // Grande de verdad: es lo único que tiene que leerse en un segundo.
        fontSize: 'clamp(26px, 3.2vw, 40px)',
        letterSpacing: '-0.03em', lineHeight: 1.12,
        margin: '0 0 12px', color: 'var(--ink)',
      }}>
        <span aria-hidden style={{
          flex: 'none', width: 12, height: 12, borderRadius: '50%',
          background: color, marginTop: '0.45em',
        }} />
        <span>{foco.accion}</span>
      </h2>

      {/* La razón, y nada más. Es la mitad del contrato que sostiene la orden. */}
      <p style={{
        fontSize: 16, color: 'var(--dim)', lineHeight: 1.5,
        margin: '0 0 22px', maxWidth: '70ch', paddingLeft: 26,
      }}>
        {foco.razon}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingLeft: 26 }}>
        <Link href={foco.href} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '13px 22px', borderRadius: 11,
          background: 'var(--primary)', color: '#fff',
          fontSize: 15.5, fontWeight: 600, textDecoration: 'none',
        }}>
          {foco.hrefLabel} →
        </Link>

        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 13.5, color: 'var(--dim)', cursor: 'pointer' }}>
          {abierto ? 'Ocultar el detalle' : 'Por qué esta y no otra'}
        </button>
      </div>

      {abierto && (
        // Los cuatro campos restantes del contrato. En prosa y en un renglón por
        // campo, sin rótulos en monospace y sin grilla de tres columnas: lo que
        // hacía que esto se leyera como un formulario era la grilla, no los datos.
        <dl style={{
          margin: '20px 0 0 26px', padding: '16px 0 0',
          borderTop: '1px solid var(--border)',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 18px',
          fontSize: 14, lineHeight: 1.5, maxWidth: '70ch',
        }}>
          <dt style={{ color: 'var(--faint)' }}>Sale de</dt>
          <dd style={{ margin: 0, color: 'var(--dim)' }}>{ORIGEN_LABEL[foco.origen]}</dd>

          <dt style={{ color: 'var(--faint)' }}>Debería mover</dt>
          <dd style={{ margin: 0, color: 'var(--dim)' }}>{foco.resultadoEsperado}</dd>

          <dt style={{ color: 'var(--faint)' }}>Quién</dt>
          <dd style={{ margin: 0, color: 'var(--dim)' }}>{foco.responsable}</dd>

          {foco.progreso && (<>
            <dt style={{ color: 'var(--faint)' }}>Progreso</dt>
            <dd style={{ margin: 0, color: 'var(--dim)' }}>{foco.progreso}</dd>
          </>)}

          <dt style={{ color: 'var(--faint)' }}>Se revisa</dt>
          <dd style={{ margin: 0, color: 'var(--dim)' }}>{foco.siguienteRevision}</dd>
        </dl>
      )}
    </section>
  );
}
