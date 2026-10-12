// =============================================================================
// CalificacionCard — «¿Era calificado?» sin depender de una reunión
// =============================================================================
// Pedido textual de Martín (05/10/2026): «es bien importante que esté claro la
// sección de "¿Era calificado?" que hoy en día lo tenemos solo editable en las
// reuniones… con todos los funnels que tenemos y algunos funnel NO tienen
// reuniones, esa data tan valiosa que le envía a Meta CAPI para que nos traigan
// mejores leads, jamás se pueden editar… Entonces, el botón para marcar como
// calificado lo pondría tal vez en tracking».
//
// Va en la pestaña Tracking, pegada a «Origen del lead», porque las dos son el
// MISMO par: de qué anuncio vino y si valía la pena. Son también los dos únicos
// datos del CRM que viajan a Meta.
//
// ⚠️ NO ES UN SEGUNDO CONTROL CON SU PROPIA VERDAD. Es el mismo `TriEditable` que
// la tarjeta de Reuniones, sobre la misma columna, por la misma server action
// (`guardarCampoLeadAction` → `updateLead`, el único que avisa a Meta) y con el
// mismo candado (`calificadoSeDescarta`). Dos controles que contestan lo mismo por
// caminos distintos parten la respuesta en dos; esta casa ya lo pagó.
//
// ⚠️ Y SE DIBUJA SIEMPRE, también sin reunión: ése es justo el lead que no se podía
// marcar. Lo único que lo bloquea es que CONSTE que no vino a la R1 — ahí
// `updateLead` descarta el dato y un control clickeable rebotaría.

import type { CSSProperties } from 'react';
import type { Lead } from '@/lib/leads';
import { calificadoSeDescarta } from '@/lib/calificado-reunion';
import { CajaCampo, TriEditable } from './CampoEditable';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export function CalificacionCard({ lead }: { lead: Lead }) {
  const noVino = calificadoSeDescarta(lead);

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Calificación</div>
      {/* Un clic en la pregunta también abre el sí/no (punto 7, 12/10/2026). */}
      <CajaCampo style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>¿Era un lead calificado?</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45, marginTop: 3 }}>
            {noVino
              ? 'No asistió a la reunión 1, así que no hay nada que calificar.'
              : 'Meta aprende de esto para traerte leads parecidos.'}
          </div>
        </div>
        <TriEditable
          leadId={lead.id}
          campo="calificado"
          valor={lead.calificado}
          si="Calificado"
          no="No calificado"
          titulo="¿Era un lead calificado?"
          bloqueado={noVino}
        />
      </CajaCampo>
    </section>
  );
}
