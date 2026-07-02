'use client';

// =============================================================================
// AuditHistory — historial de cambios de un lead (fetch client-side)
// =============================================================================
// Extraído de LeadDetail para compartirlo entre el modal y la ruta /leads/[id]:
// quien edita también ve quién tocó qué antes de pisar un dato.

import { useEffect, useState, type CSSProperties } from 'react';
import { getLeadAuditAction } from '../actions';
import type { LeadAuditRow } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtAuditDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Tijuana' }).format(d);
};
const autorColor = (a: string) => (a === 'Fathom' ? '#0E8E7E' : a === 'Calendly' ? '#2F6DDB' : a === 'CRM' ? '#8A6D3B' : '#5B6472');

export function AuditHistory({ leadId }: { leadId: number }) {
  const [audit, setAudit] = useState<LeadAuditRow[]>([]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auditLeadId, setAuditLeadId] = useState(leadId);
  if (auditLeadId !== leadId) { setAuditLeadId(leadId); setLoading(true); setErr(false); }

  useEffect(() => {
    let alive = true;
    getLeadAuditAction(leadId)
      .then((r) => { if (alive) { setAudit(r); setErr(false); } })
      .catch(() => { if (alive) setErr(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId]);

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Historial de cambios</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {audit.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', width: 112 }}>{fmtAuditDate(a.created_at)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)' }}>
              <b style={{ fontWeight: 600 }}>{a.campo}</b>: {a.valor_anterior ?? '—'} → {a.valor_nuevo ?? '—'}
            </span>
            <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: autorColor(a.autor), background: autorColor(a.autor) + '1A', borderRadius: 999, padding: '2px 8px' }}>{a.autor}</span>
          </div>
        ))}
        {audit.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>
            {loading ? 'Cargando historial…' : err ? 'No se pudo cargar el historial. Reintentá reabriendo la ficha.' : 'Sin cambios registrados todavía. Cada movimiento de etapa, edición o evento de Fathom va a aparecer acá.'}
          </div>
        )}
      </div>
    </section>
  );
}
