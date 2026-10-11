'use client';

// =============================================================================
// AuditHistory — historial de cambios del lead
// =============================================================================
// Dos sub-tabs: cambios de STATUS (etapa/estado) y cambios de INFORMACIÓN (el
// resto). Cada fila muestra QUIÉN hizo el cambio (nombre + foto de perfil si es
// un usuario; chip para sistemas: Fathom/Calendly/CRM) y, cuando el campo tiene
// mapeo directo, un botón "Deshacer" que revierte ese cambio puntual.

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRefrescarFicha } from './ficha-cambio';
import { stageMetaOpt, type Stage } from '@/lib/pipeline';
import { normalizar as normTxt } from '@/lib/buscar-texto';
import { getLeadAuditAction, revertMoveAction, type LeadAuditRowFull } from '../actions';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useTzWorkspace } from './useTzWorkspace';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtAuditDate = (iso: string, tz: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // Formato corto 24h — entra en una línea, sin "a.m./p.m." colgando.
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d).replace(',', '');
};

/** Nombres legibles del estado canónico. */
const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto', ganado: 'Ganado', perdido: 'Perdido', descalificado: 'Descalificado', no_responde: 'No responde',
};
// El color de cada sistema que firma el historial. Stripe y Mercado Pago (11/10/2026) firman los
// cobros de la pasarela («Pago registrado», «Pago reembolsado»…) con su nombre, sin '@'.
const SYS_COLOR: ReadonlyMap<string, string> = new Map([
  ['Fathom', '#0E8E7E'], ['Calendly', '#2F6DDB'], ['Stripe', '#635BFF'], ['Mercado Pago', '#009EE3'],
]);
const sysColor = (a: string) => SYS_COLOR.get(a) ?? '#8A6D3B';

/** Campos que cuentan como cambio de STATUS (el resto es INFORMACIÓN). */
const STATUS_FIELDS = new Set(['Etapa', 'Estado', 'Nutrición manual', 'Auditoría']);

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';


// Chip de etapa/estado: el punto lleva el color del funnel, así el recorrido se lee
// de un vistazo sin tener que comparar textos largos.
function ChipEtapa({ texto, dot }: { texto: string; dot?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
      {dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flex: 'none' }} />}
      {texto}
    </span>
  );
}

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
  const refrescarFicha = useRefrescarFicha();
  const tz = useTzWorkspace();

  // Resuelve el valor guardado de una etapa. Acepta la KEY (lo correcto) y también
  // la ETIQUETA (historial reconstruido viejo). Si no la reconoce devuelve undefined
  // y se muestra el texto crudo: acá NO se puede usar stageMeta, que ante un valor
  // desconocido cae a la 1ª etapa y pintaba todo el historial "Lead (Instant form)".
  const resolverStage = (v: string): Stage | undefined =>
    stageMetaOpt(stages ?? [], v) ?? stages?.find((s) => normTxt(s.label) === normTxt(v));

  // Valores legibles: keys de etapa → chip con el color del funnel; estados → label.
  const legible = (campo: string, v: string | null): ReactNode => {
    if (v == null || v === '') return <span style={{ color: 'var(--faint)' }}>—</span>;
    if (campo === 'Etapa') {
      const s = resolverStage(v);
      return <ChipEtapa texto={s?.label ?? v} dot={s?.dot} />;
    }
    if (campo === 'Estado') return <ChipEtapa texto={ESTADO_LABEL[v] ?? v} />;
    return <span>{v}</span>;
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
        return { id: e.id, stage: e.valor_nuevo as string, ms: Math.max(0, to - from), actual: i + 1 === etapaEvents.length };
      })
    : [];
  // Cada tramo se muestra en SU línea del recorrido (no en una lista aparte).
  const tramoPorFila = new Map(tramos.map((t) => [t.id, t]));
  const actual = tramos.find((t) => t.actual);
  const fmtDur = (ms: number) => {
    const d = Math.floor(ms / 86400000);
    if (d >= 1) return `${d} día${d === 1 ? '' : 's'}`;
    const h = Math.floor(ms / 3600000);
    if (h >= 1) return `${h} h`;
    return `${Math.max(1, Math.floor(ms / 60000))} min`;
  };

  // El punto del riel toma el color de la etapa a la que se MOVIO el lead.
  const puntoDe = (g: LeadAuditRowFull[]) => {
    const et = g.find((r) => r.campo === 'Etapa' && r.valor_nuevo);
    return (et && resolverStage(et.valor_nuevo as string)?.dot) || 'var(--border-strong)';
  };

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
        refrescarFicha();
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

      {/* Dónde está HOY y hace cuánto. El tiempo de cada etapa anterior va en su
          propia línea del recorrido, para no repetir dos veces la misma lista. */}
      {subTab === 'status' && actual && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Ahora en</span>
          <ChipEtapa texto={resolverStage(actual.stage)?.label ?? actual.stage} dot={resolverStage(actual.stage)?.dot} />
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>hace {fmtDur(actual.ms)}</span>
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
            <div key={head.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              {/* Riel de la línea de tiempo: el punto marca el movimiento y la
                  línea lo une con el anterior. Se corta en el más viejo. */}
              <span aria-hidden style={{ flex: 'none', width: 9, marginLeft: 4, position: 'relative', borderLeft: gi === grupos.length - 1 ? 'none' : '1.5px solid var(--border)' }}>
                <span style={{ position: 'absolute', left: -5.5, top: 15, width: 10, height: 10, borderRadius: '50%', background: puntoDe(g), border: '2px solid var(--surface)', boxSizing: 'border-box' }} />
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtAuditDate(head.created_at, tz)}</span>
              <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.map((a) => {
                  const t = tramoPorFila.get(a.id);
                  return (
                  <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    {/* En Status el campo es siempre la etapa: repetir "Etapa:" en
                        cada línea es ruido. Sin valor anterior no hay flecha. */}
                    {!(a.campo === 'Etapa' && subTab === 'status') && <b style={{ fontWeight: 600 }}>{a.campo}:</b>}
                    {a.valor_anterior ? (
                      <>{legible(a.campo, a.valor_anterior)} <span style={{ color: 'var(--faint)' }}>→</span> {legible(a.campo, a.valor_nuevo)}</>
                    ) : (
                      <>{a.campo === 'Etapa' && <span style={{ color: 'var(--dim)', fontSize: 12.5 }}>Entró a</span>} {legible(a.campo, a.valor_nuevo)}</>
                    )}
                    {t && !t.actual && <span style={{ color: 'var(--faint)', fontSize: 12 }}>· {fmtDur(t.ms)} aquí</span>}
                  </span>
                  );
                })}
              </span>
              <Autor row={head} />
              {revertible && (
                <button type="button" onClick={() => setConfirmRevert({ createdAt: head.created_at, reciente })} disabled={pending} title={reciente ? 'Deshacer este movimiento (borra el rastro del historial)' : 'Volver al estado anterior (borra el rastro del historial)'} style={{ flex: 'none', padding: '5px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.5 : 1 }}>↶ {reciente ? 'Deshacer' : 'Restaurar'}</button>
              )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>
            {loading ? 'Cargando historial…' : err ? 'No se pudo cargar el historial. Reintenta reabriendo la ficha.' : subTab === 'status' ? 'Sin cambios de status registrados todavía.' : 'Sin cambios de información registrados todavía.'}
          </div>
        )}
      </div>

      {confirmRevert && (
        <ConfirmDialog
          title={confirmRevert.reciente ? 'Deshacer este movimiento' : 'Restaurar al estado anterior'}
          message={<>Se van a revertir los valores de este cambio y <b>se va a borrar del historial</b> (no queda un registro nuevo). ¿Confirmas?</>}
          confirmLabel={confirmRevert.reciente ? 'Sí, deshacer' : 'Sí, restaurar'}
          onConfirm={() => { const c = confirmRevert; setConfirmRevert(null); deshacer(c.createdAt); }}
          onCancel={() => setConfirmRevert(null)}
          zIndex={120}
        />
      )}
    </section>
  );
}
