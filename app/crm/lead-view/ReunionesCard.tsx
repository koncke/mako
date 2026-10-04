// =============================================================================
// ReunionesCard — R1/R2 del lead, organizadas POR REUNIÓN (presentacional)
// =============================================================================
// Cada reunión es un bloque: fecha + asistencia (+ calificado en R1) + sus
// grabaciones de Fathom + las respuestas del formulario de Calendly de ESA
// agenda (R1 y R2 tienen forms propios). Al pie, el equipo y la confirmación.

import type { CSSProperties, ReactNode } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead, FathomLink, RespuestaQA } from '@/lib/leads';
import type { MiembroEquipo } from '../actions';
import { esMaKo, MAKO_STAR_URI } from '../mako-setter';
import { AgendarR2 } from './AgendarR2';

const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

// Nombre del closer/setter con foto del equipo si matchea (por nombre o 1er nombre).
function Persona({ label, nombre, equipo, hint }: { label: string; nombre: string | null; equipo: MiembroEquipo[]; hint?: string }) {
  const n = nombre?.trim() || '';
  const low = n.toLowerCase();
  const u = n ? equipo.find((m) => m.nombre.toLowerCase() === low || m.nombre.toLowerCase().split(' ')[0] === low.split(' ')[0]) : undefined;
  return (
    <div>
      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
        {n ? (
          <>
            {esMaKo(n) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={MAKO_STAR_URI} alt="" width={22} height={22} style={{ borderRadius: '50%', display: 'block' }} title="MaKo — nutrición automática" />
            ) : u?.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.foto_url} alt="" width={22} height={22} style={{ borderRadius: '50%', display: 'block' }} referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, background: 'var(--primary)', color: '#fff' }}>{iniciales(u?.nombre || n)}</span>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{u?.nombre || n}</span>
          </>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--faint)' }}>{hint || '—'}</span>
        )}
      </div>
    </div>
  );
}

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const chip = (v: boolean | null, si: string, no: string): ReactNode =>
  v === true ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--good)', background: 'var(--good-bg)' }}>{si}</span>
  : v === false ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--bad)', background: 'var(--bad-bg)' }}>{no}</span>
  : <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>Sin marcar</span>;

function BloqueReunion({ titulo, reunion, fecha, chips, fathom, respuestas }: {
  titulo: string;
  reunion: 'R1' | 'R2';
  fecha: string | null;
  chips: ReactNode;
  fathom: FathomLink[];
  respuestas: RespuestaQA[];
}) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{titulo}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: fecha ? 'var(--dim)' : 'var(--faint)' }}>{fecha ? fmtDDMMYYYY(fecha) : 'sin fecha'}</span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{chips}</div>
      </div>

      {fathom.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {fathom.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.label || 'Grabación'} (Fathom)</span>
              <span style={{ fontSize: 12.5, color: 'var(--accent)' }}>Abrir →</span>
            </a>
          ))}
        </div>
      )}

      {respuestas.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', listStyle: 'none' }}>
            Respuestas del formulario de Calendly ({reunion}) · {respuestas.length} ▾
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {respuestas.map((r, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 3 }}>{r.q}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{r.a}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ReunionesCard({ lead, respuestas, equipo = [], closerDetectado }: { lead: Lead; respuestas?: { R1: RespuestaQA[]; R2: RespuestaQA[] }; equipo?: MiembroEquipo[]; closerDetectado?: string | null }) {
  const agendo = !!lead.fecha_junta_1 || !!lead.fecha_junta_2 || !!lead.fecha_agenda || lead.asistio_j1 != null;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);
  // Heurística de asignación de grabaciones: por etiqueta; lo no etiquetado va a R1.
  const esR2 = (f: FathomLink) => /r2|reuni[oó]n 2|junta 2/i.test(f.label ?? '');
  const fathomR1 = links.filter((f) => !esR2(f));
  const fathomR2 = links.filter(esR2);
  const tuvoR2 = !!lead.fecha_junta_2 || lead.asistio_j2 != null;
  const r1 = respuestas?.R1 ?? [];
  const r2 = respuestas?.R2 ?? [];

  if (!agendo) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Reuniones</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Este lead todavía no agendó ninguna reunión. Cuando agende (por Calendly o a mano) los datos de R1/R2 aparecen aquí.</p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Reuniones</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BloqueReunion
          titulo="Reunión 1"
          reunion="R1"
          fecha={lead.fecha_junta_1 ?? lead.fecha_agenda}
          chips={<>{chip(lead.asistio_j1, 'Asistió', 'No asistió')}{lead.asistio_j1 === true && chip(lead.calificado, 'Calificado', 'No calificado')}</>}
          fathom={fathomR1}
          respuestas={r1}
        />
        {tuvoR2 && (
          <BloqueReunion
            titulo="Reunión 2"
            reunion="R2"
            fecha={lead.fecha_junta_2}
            chips={chip(lead.asistio_j2, 'Asistió', 'No asistió')}
            fathom={fathomR2}
            respuestas={r2}
          />
        )}
        {/* ⚠️ AL LADO DE LAS REUNIONES Y SÓLO SI TODAVÍA NO HAY R2. El caso que
            esto resuelve es salir de la R1 con la segunda reunión ya agendada, así
            que con una R2 encima el botón ofrecería una segunda — reagendar es
            otra cosa y se hace desde el wizard de etapa.

            Y `sin_r2` lo apaga igual: es «cierre sin Reunión 2», o sea una persona
            que ya declaró que esta venta no la lleva. Ofrecerle agendarla es
            ofrecerle deshacer una decisión que tomó en otra pantalla.

            El control se apaga solo si el negocio no puede usarlo (ver AgendarR2). */}
        {!tuvoR2 && !lead.sin_r2 && <AgendarR2 leadId={lead.id} email={lead.email ?? null} />}
      </div>

      {/* Closer · Setter · Confirmación en recuadros que llegan hasta el ancho. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          {/* Closer: si está vacío pero Fathom detectó uno, lo mostramos como sugerencia. */}
          <Persona label="Closer" nombre={lead.closer || closerDetectado || null} equipo={equipo} hint={closerDetectado && !lead.closer ? `${closerDetectado} (de Fathom)` : undefined} />
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <Persona label="Setter" nombre={lead.setter ?? null} equipo={equipo} />
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Confirmación de pago</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: lead.fecha_confirmacion ? 'var(--ink)' : 'var(--faint)', marginTop: 3 }}>{lead.fecha_confirmacion ? fmtDDMMYYYY(lead.fecha_confirmacion) : '—'}</div>
        </div>
      </div>
    </section>
  );
}
