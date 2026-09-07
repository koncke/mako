// =============================================================================
// AHORA — el bloque que contesta «¿qué es lo más importante que debo hacer?»
// =============================================================================
// Es el que se lleva el espacio grande de la pantalla, y esa inversión es el
// cambio de fondo: antes el norte era un contador de 108 px y la acción no
// existía. Ahora el norte es una tira de una línea y esto es lo que se ve.
//
// Los SEIS CAMPOS los fijó el dueño (#523) y se pintan todos: acción, razón,
// resultado esperado, responsable, progreso y siguiente revisión. Más el ORIGEN,
// sin el cual la pantalla es una orden sin fundamento.
//
// ⚠️ Y el botón va al lugar EXACTO donde se ejecuta, no a la home de la tab. El
// pedido, textual: «la prioridad no es un texto descriptivo, es una acción con su
// enlace o botón directo al lugar donde se ejecuta».
//
// Sin `'use client'`: no tiene estado. Un componente que sólo pinta no necesita
// viajar al navegador — y este trae adentro el texto del foco, que se calcula en
// el server.
// =============================================================================

import Link from '@/app/_ui/Link';
import type { Foco } from '@/lib/focus';
import { ORIGEN_LABEL } from '@/lib/focus';

const MONO = "'Geist Mono', monospace";

const TONO_BORDE: Record<Foco['nivel'], string> = {
  rojo: 'var(--bad)',
  ambar: 'var(--warn-fill)',
  neutro: 'var(--border-strong)',
};

/** Un campo del contrato. El rótulo chico arriba, el contenido abajo, en prosa. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function Ahora({ foco }: { foco: Foco }) {
  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      // El nivel se lee en el filete izquierdo, igual que en el Semáforo: es el
      // mismo lenguaje en la misma pantalla, no un tratamiento nuevo.
      borderLeft: `4px solid ${TONO_BORDE[foco.nivel]}`,
      borderRadius: 18,
      padding: 'var(--card-pad)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Ahora
        </span>
        {/* El ORIGEN va acá arriba y no escondido: una orden sin fundamento no se
            obedece, se ignora. */}
        <span style={{
          fontSize: 12, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
          background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--dim)',
        }}>
          sale de: {ORIGEN_LABEL[foco.origen]}
        </span>
      </div>

      <h2 style={{
        fontWeight: 600, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.2,
        margin: '0 0 10px', color: 'var(--ink)',
      }}>
        {foco.accion}
      </h2>

      <p style={{ fontSize: 15, color: 'var(--dim)', margin: '0 0 22px', lineHeight: 1.55, maxWidth: '70ch' }}>
        {foco.razon}
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18,
        paddingTop: 18, borderTop: '1px solid var(--border)',
      }}>
        <Campo label="Debería mover">{foco.resultadoEsperado}</Campo>
        <Campo label="Quién">{foco.responsable}</Campo>
        {foco.progreso && <Campo label="Progreso">{foco.progreso}</Campo>}
        <Campo label="Se revisa">{foco.siguienteRevision}</Campo>
      </div>

      <div style={{ marginTop: 22 }}>
        <Link href={foco.href} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 11,
          background: 'var(--primary)', color: '#fff',
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
        }}>
          Ir a {foco.hrefLabel} →
        </Link>
      </div>
    </section>
  );
}
