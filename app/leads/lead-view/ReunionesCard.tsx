// =============================================================================
// ReunionesCard — R1/R2 del lead (solo lectura, presentacional)
// =============================================================================
// Fechas, asistencias, calificado, closer/setter y links de Fathom.

import type { CSSProperties, ReactNode } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead, FathomLink } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

const yesNo = (v: boolean | null): ReactNode =>
  v === true ? <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--good)', background: 'var(--good-bg)' }}>Sí</span>
  : v === false ? <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--bad)', background: 'var(--bad-bg)' }}>No</span>
  : <span style={{ color: 'var(--faint)' }}>—</span>;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value === '—' || value == null || value === '';
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 15, color: isEmpty ? 'var(--faint)' : 'var(--ink)', fontWeight: isEmpty ? 400 : 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

export function ReunionesCard({ lead }: { lead: Lead }) {
  const agendo = !!lead.fecha_junta_1 || !!lead.fecha_junta_2 || !!lead.fecha_agenda || lead.asistio_j1 != null;
  const fathomLinks = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);
  const tuvoR2 = !!lead.fecha_junta_2 || lead.asistio_j2 != null;

  if (!agendo) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Reuniones</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Este lead todavía no agendó ninguna reunión. Cuando agende (por Calendly o a mano) los datos de R1/R2 aparecen acá.</p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Reuniones</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
        <Stat label="Fecha Reunión 1" value={lead.fecha_junta_1 ? fmtDDMMYYYY(lead.fecha_junta_1) : lead.fecha_agenda ? fmtDDMMYYYY(lead.fecha_agenda) : '—'} />
        <Stat label="¿Asistió a R1?" value={yesNo(lead.asistio_j1)} />
        <Stat label="¿Era calificado?" value={yesNo(lead.calificado)} />
        {tuvoR2 && <Stat label="Fecha Reunión 2" value={lead.fecha_junta_2 ? fmtDDMMYYYY(lead.fecha_junta_2) : '—'} />}
        {tuvoR2 && <Stat label="¿Asistió a R2?" value={yesNo(lead.asistio_j2)} />}
        {lead.fecha_confirmacion && <Stat label="Confirmación de pago" value={fmtDDMMYYYY(lead.fecha_confirmacion)} />}
        <Stat label="Closer" value={lead.closer || '—'} />
        <Stat label="Setter" value={lead.setter || '—'} />
      </div>
      {fathomLinks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {fathomLinks.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{f.label || 'Llamada'} (Fathom)</span>
              <span style={{ fontSize: 13, color: 'var(--accent)' }}>Abrir →</span>
            </a>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 12 }}>Sin grabaciones de Fathom cargadas todavía.</p>
      )}
    </section>
  );
}
