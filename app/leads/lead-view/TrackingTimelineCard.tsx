// =============================================================================
// TrackingTimelineCard — actividad del lead con fecha y hora, evento por evento
// =============================================================================
// "03/07/2026 14:04 · Ingresó a la landing" / "Reprodujo el VSL" / "Llegó al
// 40% del VSL" / "Abandonó en el 73%". Con la URL de la landing y el título del
// VSL cuando el beacon los manda (pruebas A/B multi-landing / multi-VSL).

import type { CSSProperties } from 'react';
import type { TrackingEvent } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtTs = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Tijuana' }).format(d).replace(',', ' ·');
};

function descripcion(e: TrackingEvent): { texto: string; detalle: string | null; color: string } {
  switch (e.tipo) {
    case 'pageview':
      return { texto: 'Ingresó a la landing', detalle: e.landing_url, color: 'var(--accent)' };
    case 'play':
      return { texto: 'Reprodujo el VSL', detalle: e.vsl_titulo ?? (e.video_id ? `video ${e.video_id}` : null), color: 'var(--primary)' };
    case 'exit':
      return { texto: e.porcentaje != null ? `Abandonó el VSL en el ${e.porcentaje}%` : 'Abandonó el VSL', detalle: e.vsl_titulo, color: 'var(--bad)' };
    default:
      return { texto: e.porcentaje != null ? `Llegó al ${e.porcentaje}% del VSL` : 'Siguió mirando el VSL', detalle: e.vsl_titulo, color: 'var(--good)' };
  }
}

export function TrackingTimelineCard({ eventos }: { eventos: TrackingEvent[] }) {
  // Los hitos de retención cada 5% son ruido en la lista: nos quedamos con los
  // pageviews, plays, abandonos y el hito MÁXIMO de cada racha de retención.
  const filtrados: TrackingEvent[] = [];
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    if (e.tipo !== 'retencion') { filtrados.push(e); continue; }
    // eventos está ordenado desc: el primero de cada racha es el hito más alto.
    const prev = filtrados[filtrados.length - 1];
    if (!prev || prev.tipo !== 'retencion') filtrados.push(e);
  }

  if (!filtrados.length) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Actividad registrada</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>
          Sin eventos registrados para este lead: entró antes del tracking, o llegó por instant form sin pasar por la landing. No hay forma de reconstruirlo.
        </p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Actividad registrada</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtrados.slice(0, 40).map((e, i) => {
          const d = descripcion(e);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtTs(e.ts)}</span>
              <span aria-hidden style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, background: d.color, alignSelf: 'center' }} />
              <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{d.texto}</span>
              {d.detalle && <span style={{ fontSize: 12.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320, whiteSpace: 'nowrap' }}>{d.detalle}</span>}
            </div>
          );
        })}
        {filtrados.length > 40 && <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '4px 0 0' }}>Mostrando los últimos 40 eventos.</p>}
      </div>
    </section>
  );
}
