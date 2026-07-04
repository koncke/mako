'use client';

// =============================================================================
// AuditHistory — historial de cambios del lead
// =============================================================================
// Dos sub-tabs: cambios de STATUS (etapa/estado) y cambios de INFORMACIÓN (el
// resto). Cada fila muestra QUIÉN hizo el cambio (nombre + foto de perfil si es
// un usuario; chip para sistemas: Fathom/Calendly/CRM) y, cuando el campo tiene
// mapeo directo, un botón "Deshacer" que revierte ese cambio puntual.

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { stageMeta, type Stage } from '@/lib/pipeline';
import { getLeadAuditAction, revertAuditChangeAction, type LeadAuditRowFull } from '../actions';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtAuditDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // Formato corto 24h — entra en una línea, sin "a.m./p.m." colgando.
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Tijuana' }).format(d).replace(',', '');
};

/** Nombres legibles del estado canónico. */
const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto', ganado: 'Ganado', perdido: 'Perdido', descalificado: 'Descalificado', no_responde: 'No responde',
};
const sysColor = (a: string) => (a === 'Fathom' ? '#0E8E7E' : a === 'Calendly' ? '#2F6DDB' : '#8A6D3B');

/** Campos que cuentan como cambio de STATUS (el resto es INFORMACIÓN). */
const STATUS_FIELDS = new Set(['Etapa', 'Estado', 'Nutrición manual', 'Auditoría']);

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

function Autor({ row }: { row: LeadAuditRowFull }) {
  const esUsuario = row.autor.includes('@');
  if (!esUsuario) {
    const c = sysColor(row.autor);
    return <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: c, background: c + '1A', borderRadius: 999, padding: '2px 8px' }}>{row.autor_nombre}</span>;
  }
  return (
    <span title={row.autor} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {row.autor_foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.autor_foto} alt="" width={20} height={20} style={{ borderRadius: '50%', display: 'block' }} referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: 'var(--primary)', color: '#fff' }}>{initials(row.autor_nombre)}</span>
      )}
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.autor_nombre}</span>
    </span>
  );
}

export function AuditHistory({ leadId, stages }: { leadId: number; stages?: Stage[] }) {
  const router = useRouter();

  // Valores legibles: keys de etapa → label del funnel; estados → label; chips.
  const legible = (campo: string, v: string | null): ReactNode => {
    if (v == null || v === '') return <span style={{ color: 'var(--faint)' }}>—</span>;
    let txt = v;
    if (campo === 'Etapa' && stages?.length) txt = stageMeta(stages, v)?.label ?? v;
    if (campo === 'Estado') txt = ESTADO_LABEL[v] ?? v;
    if (campo === 'Etapa' || campo === 'Estado') {
      return <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--ink)' }}>{txt}</span>;
    }
    return <span>{txt}</span>;
  };
  const [pending, startTransition] = useTransition();
  const [audit, setAudit] = useState<LeadAuditRowFull[]>([]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'status' | 'info'>('status');
  const [revertErr, setRevertErr] = useState<string | null>(null);
  const [auditLeadId, setAuditLeadId] = useState(leadId);
  if (auditLeadId !== leadId) { setAuditLeadId(leadId); setLoading(true); setErr(false); }

  const cargar = () => {
    getLeadAuditAction(leadId)
      .then((r) => { setAudit(r); setErr(false); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    let alive = true;
    getLeadAuditAction(leadId)
      .then((r) => { if (alive) { setAudit(r); setErr(false); } })
      .catch(() => { if (alive) setErr(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId]);

  const esStatus = (r: LeadAuditRowFull) => STATUS_FIELDS.has(r.campo);
  const statusRows = audit.filter(esStatus);
  const infoRows = audit.filter((r) => !esStatus(r));
  const rows = subTab === 'status' ? statusRows : infoRows;

  const deshacer = (r: LeadAuditRowFull) => {
    setRevertErr(null);
    startTransition(async () => {
      try {
        await revertAuditChangeAction(r.id, leadId);
        cargar();
        router.refresh();
      } catch (e) {
        setRevertErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const subBtn = (active: boolean): CSSProperties => ({ padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={sectLabel}>Historial de cambios</div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 3 }}>
          <button type="button" onClick={() => setSubTab('status')} style={subBtn(subTab === 'status')}>Status{statusRows.length ? ` · ${statusRows.length}` : ''}</button>
          <button type="button" onClick={() => setSubTab('info')} style={subBtn(subTab === 'info')}>Información{infoRows.length ? ` · ${infoRows.length}` : ''}</button>
        </div>
      </div>

      {revertErr && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 10 }}>{revertErr}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtAuditDate(a.created_at)}</span>
            <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <b style={{ fontWeight: 600 }}>{a.campo}:</b> {legible(a.campo, a.valor_anterior)} <span style={{ color: 'var(--faint)' }}>→</span> {legible(a.campo, a.valor_nuevo)}
            </span>
            <Autor row={a} />
            {a.revertible && a.valor_anterior !== a.valor_nuevo && (
              <button type="button" onClick={() => deshacer(a)} disabled={pending} title={`Volver a "${a.valor_anterior ?? '—'}" (queda registrado en el historial)`} style={{ flex: 'none', padding: '5px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>↶ Restaurar</button>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>
            {loading ? 'Cargando historial…' : err ? 'No se pudo cargar el historial. Reintentá reabriendo la ficha.' : subTab === 'status' ? 'Sin cambios de status registrados todavía.' : 'Sin cambios de información registrados todavía.'}
          </div>
        )}
      </div>
    </section>
  );
}
