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
import { getLeadAuditAction, revertMoveAction, type LeadAuditRowFull } from '../actions';
import { ConfirmDialog } from '../../components/ConfirmDialog';

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
  // Confirmación antes de deshacer/restaurar (nunca se revierte de un click seco).
  const [confirmRevert, setConfirmRevert] = useState<{ createdAt: string; reciente: boolean } | null>(null);
  const [now, setNow] = useState(0); // Date.now() de la última carga (para "Deshacer" vs "Restaurar")
  const [auditLeadId, setAuditLeadId] = useState(leadId);
  if (auditLeadId !== leadId) { setAuditLeadId(leadId); setLoading(true); setErr(false); }

  const cargar = () => {
    getLeadAuditAction(leadId)
      .then((r) => { setAudit(r); setErr(false); setNow(Date.now()); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    let alive = true;
    getLeadAuditAction(leadId)
      .then((r) => { if (alive) { setAudit(r); setErr(false); setNow(Date.now()); } })
      .catch(() => { if (alive) setErr(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId]);

  // Refrescar al volver a la pestaña/ventana: si el usuario completó datos en el
  // wizard y vuelve al historial, ve el cambio al instante (no "en unos minutos").
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState !== 'hidden') cargar(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const esStatus = (r: LeadAuditRowFull) => STATUS_FIELDS.has(r.campo);
  const statusRows = audit.filter(esStatus);
  const infoRows = audit.filter((r) => !esStatus(r));
  const rows = subTab === 'status' ? statusRows : infoRows;

  // Tiempo que el lead estuvo (sin resolver) en cada etapa: se deriva de los
  // cambios de "Etapa" del historial. Cada evento marca cuándo ENTRÓ a esa etapa;
  // estuvo ahí hasta el cambio siguiente (o hasta hoy, si es la etapa actual).
  const etapaEvents = audit
    .filter((r) => r.campo === 'Etapa' && r.valor_nuevo)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const tramos = now > 0
    ? etapaEvents.map((e, i) => {
        const from = new Date(e.created_at).getTime();
        const to = i + 1 < etapaEvents.length ? new Date(etapaEvents[i + 1].created_at).getTime() : now;
        return { stage: e.valor_nuevo as string, ms: Math.max(0, to - from), actual: i + 1 === etapaEvents.length };
      })
    : [];
  const fmtDur = (ms: number) => {
    const d = Math.floor(ms / 86400000);
    if (d >= 1) return `${d} día${d === 1 ? '' : 's'}`;
    const h = Math.floor(ms / 3600000);
    if (h >= 1) return `${h} h`;
    return `${Math.max(1, Math.floor(ms / 60000))} min`;
  };
  const etapaLabel = (k: string) => (stages?.length ? stageMeta(stages, k)?.label ?? k : k);

  // Un "movimiento" = todas las filas escritas en el mismo instante por el mismo
  // autor (un drag Ganado→Lead escribe Etapa+Estado+Monto a la vez). Se agrupan
  // para revertir todo junto, no campo por campo (que dejaba datos a medias).
  const grupos: LeadAuditRowFull[][] = [];
  for (const r of rows) {
    const ult = grupos[grupos.length - 1];
    if (ult && ult[0].created_at === r.created_at && ult[0].autor === r.autor) ult.push(r);
    else grupos.push([r]);
  }

  const deshacer = (createdAt: string) => {
    setRevertErr(null);
    startTransition(async () => {
      try {
        await revertMoveAction(leadId, createdAt);
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

      {/* Tiempo sin resolver en cada etapa (solo en el sub-tab Status). */}
      {subTab === 'status' && tramos.length > 0 && (
        <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ ...sectLabel, marginBottom: 9 }}>Tiempo en cada etapa</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tramos.map((t, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, padding: '4px 11px', borderRadius: 999, background: t.actual ? 'var(--accent-soft, #FBF3DE)' : 'var(--surface)', border: '1px solid ' + (t.actual ? '#EBD9A8' : 'var(--border-strong)'), color: 'var(--ink)' }}>
                <b style={{ fontWeight: 600 }}>{etapaLabel(t.stage)}</b>
                <span style={{ color: 'var(--dim)', fontFamily: MONO, fontSize: 11.5 }}>{fmtDur(t.ms)}{t.actual ? ' · actual' : ''}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {grupos.map((g, gi) => {
          const head = g[0];
          const revertibleBase = g.some((r) => r.revertible && r.valor_anterior !== r.valor_nuevo);
          // STATUS solo se deshace de a uno, empezando por el ÚLTIMO (grupos viene
          // ordenado más-reciente-primero → solo el índice 0 muestra el botón).
          // INFORMACIÓN sí se puede revertir campo por campo, en cualquier orden.
          const revertible = revertibleBase && (subTab === 'info' || gi === 0);
          // "Deshacer" para cambios recientes (<10 min); pasado eso, "Restaurar".
          // Ambos revierten Y borran el rastro (un cambio deshecho no es historia).
          const reciente = now > 0 && now - new Date(head.created_at).getTime() < 10 * 60_000;
          return (
            <div key={head.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtAuditDate(head.created_at)}</span>
              <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {g.map((a) => (
                  <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <b style={{ fontWeight: 600 }}>{a.campo}:</b> {legible(a.campo, a.valor_anterior)} <span style={{ color: 'var(--faint)' }}>→</span> {legible(a.campo, a.valor_nuevo)}
                  </span>
                ))}
              </span>
              <Autor row={head} />
              {revertible && (
                <button type="button" onClick={() => setConfirmRevert({ createdAt: head.created_at, reciente })} disabled={pending} title={reciente ? 'Deshacer este movimiento (borra el rastro del historial)' : 'Volver al estado anterior (borra el rastro del historial)'} style={{ flex: 'none', padding: '5px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>↶ {reciente ? 'Deshacer' : 'Restaurar'}</button>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>
            {loading ? 'Cargando historial…' : err ? 'No se pudo cargar el historial. Reintentá reabriendo la ficha.' : subTab === 'status' ? 'Sin cambios de status registrados todavía.' : 'Sin cambios de información registrados todavía.'}
          </div>
        )}
      </div>

      {confirmRevert && (
        <ConfirmDialog
          title={confirmRevert.reciente ? 'Deshacer este movimiento' : 'Restaurar al estado anterior'}
          message={<>Se van a revertir los valores de este cambio y <b>se va a borrar del historial</b> (no queda un registro nuevo). ¿Confirmás?</>}
          confirmLabel={confirmRevert.reciente ? 'Sí, deshacer' : 'Sí, restaurar'}
          onConfirm={() => { const c = confirmRevert; setConfirmRevert(null); deshacer(c.createdAt); }}
          onCancel={() => setConfirmRevert(null)}
          zIndex={120}
        />
      )}
    </section>
  );
}
