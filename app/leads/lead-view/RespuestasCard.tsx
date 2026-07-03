// =============================================================================
// RespuestasCard — respuestas del formulario de Calendly (solo lectura)
// =============================================================================
// Extraída de EditLeadForm para compartirla entre el modal y la ruta.

import type { CSSProperties } from 'react';
import type { Lead } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export function RespuestasCard({ lead }: { lead: Lead }) {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: '¿Qué quiere lograr?', value: lead.respuesta_objetivo },
    { label: '¿Puede invertir?', value: lead.respuesta_inversion },
    { label: '¿Cuántos colaboradores?', value: lead.respuesta_colaboradores },
    { label: '¿Factura +$20M MXN?', value: lead.respuesta_facturacion },
    { label: '¿Alguien más decide?', value: lead.respuesta_decisor },
    { label: '¿Cuándo quiere empezar?', value: lead.respuesta_cuando_empezar },
  ];
  const hay = rows.some((r) => r.value && r.value.trim());
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 16 }}>Respuestas del formulario</div>
      {!hay ? (
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin respuestas capturadas. Probablemente un lead orgánico, manual, o agendado antes de que el form tuviera estas preguntas.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {rows.map((r) => (
            <div key={r.label}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 14.5, color: r.value ? 'var(--ink)' : 'var(--faint)' }}>{r.value && r.value.trim() ? r.value : '—'}</div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, marginTop: 14, color: 'var(--faint)' }}>Datos automáticos del webhook de Calendly. Solo lectura.</p>
    </section>
  );
}
