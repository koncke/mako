'use client';

// =============================================================================
// GeneratedInsightCard — Insights del lead (✦ MaKo) — ÚNICA card de la tab
// =============================================================================
// Un solo lugar: MaKo lee las llamadas (Closing Analyst), formularios, chat,
// anuncio, tracking y cobranza y devuelve una lectura comercial accionable.
// SOLO se genera si hay al menos UNA llamada analizada. Si falta un dato
// completable, se pide con el wizard conocido. Diseño scaneble, no muro de texto.

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { deriveStageKey, type Stage } from '@/lib/pipeline';
import type { Lead, FathomLink } from '@/lib/leads';
import type { LeadInsightGen } from '@/lib/lead-insights';
import type { Step } from '@/lib/stage-requirements';
import { generateLeadInsightAction, analizarLlamadaLeadAction, leadTieneLlamadaAction } from '../insights-actions';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useTzWorkspace } from './useTzWorkspace';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const mini: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 16px' };
const miniLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 };

export type LlamadaRef = { tipo: string | null; fecha: string | null; url: string | null };

const fmtCuando = (iso: string, tz: string) =>
  new Date(iso).toLocaleString('es-MX', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function Chips({ items, tono }: { items: string[]; tono: 'good' | 'bad' }) {
  if (!items.length) return null;
  const c = tono === 'good' ? { color: 'var(--good)', bg: 'var(--good-bg)', bd: '#BFE6CD' } : { color: 'var(--bad)', bg: 'var(--bad-bg)', bd: '#EBBFBC' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {items.map((x, i) => <span key={i} style={{ fontSize: 12.5, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 999, padding: '4px 11px', lineHeight: 1.35 }}>{x}</span>)}
    </div>
  );
}

export function GeneratedInsightCard({ lead, stages, tienePlan, inicial, faltantesIniciales, llamadas }: {
  lead: Lead;
  stages: Stage[];
  tienePlan: boolean;
  inicial: LeadInsightGen | null;
  /** Datos completables adeudados por la etapa actual (calculados server-side). */
  faltantesIniciales: Step[];
  /** Llamadas analizadas (Closing Analyst): habilitan la generación. */
  llamadas: LlamadaRef[];
}) {
  const router = useRouter();
  const tz = useTzWorkspace();
  const [pending, startTransition] = useTransition();
  const [insight, setInsight] = useState<LeadInsightGen | null>(inicial);
  const [faltantes, setFaltantes] = useState<Step[]>(faltantesIniciales);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  // Loader de acciones progresivas del botón "Analizar la llamada".
  const [fase, setFase] = useState<string | null>(null);
  const [confirmAnalizar, setConfirmAnalizar] = useState(false);

  // Adopción de props tras router.refresh() (patrón prev-key).
  const fpProps = `${inicial?.id ?? 0}|${faltantesIniciales.map((f) => f.id).join(',')}`;
  const [fpPrev, setFpPrev] = useState(fpProps);
  if (fpProps !== fpPrev) {
    setFpPrev(fpProps);
    setInsight(inicial);
    setFaltantes(faltantesIniciales);
  }

  const currentStage = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const moveInfo: MoveLeadInfo = {
    id: lead.id, name: lead.nombre,
    fechaJ1: lead.fecha_junta_1, fechaJ2: lead.fecha_junta_2,
    asistioJ1: lead.asistio_j1, asistioJ2: lead.asistio_j2, calificado: lead.calificado,
    fathom: (lead.fathom_links ?? []) as FathomLink[],
    monto: lead.monto_cierre_usd ?? null, motivo: lead.motivo_perdida, setter: lead.setter ?? null,
    tienePlan, sinR1: !!lead.sin_r1, sinR2: !!lead.sin_r2, fathomOmitido: !!lead.fathom_omitido,
  };

  const generar = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateLeadInsightAction(lead.id);
      if (res.ok) { setInsight(res.insight); setFaltantes([]); router.refresh(); }
      else { if (res.faltantes?.length) setFaltantes(res.faltantes); setError(res.motivo); }
    });
  };

  // Proceso completo con loader progresivo (analizar/re-linkear la llamada →
  // generar el insight). El análisis real corre en analizarLlamadaLeadAction.
  const correrAnalisis = async () => {
    setFase('Se están extrayendo los datos de Fathom…');
    const an = await analizarLlamadaLeadAction(lead.id);
    if (!an.ok) { setError(an.motivo); setFase(null); return; }
    setFase('Se están generando los insights del lead…');
    const res = await generateLeadInsightAction(lead.id);
    setFase(null);
    if (res.ok) { setInsight(res.insight); setFaltantes([]); router.refresh(); }
    else { if (res.faltantes?.length) setFaltantes(res.faltantes); setError(res.motivo); router.refresh(); }
  };

  // Antes de arrancar: si la llamada NO está en Closing Analyst, pedir CONFIRMACIÓN.
  const pedirAnalisis = () => {
    setError(null);
    startTransition(async () => {
      setFase('Buscando la llamada en Closing Analyst…');
      const tiene = await leadTieneLlamadaAction(lead.id);
      if (tiene) { await correrAnalisis(); }
      else { setFase(null); setConfirmAnalizar(true); }
    });
  };
  const confirmarYAnalizar = () => { setConfirmAnalizar(false); setError(null); startTransition(() => { void correrAnalisis(); }); };

  const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: pending ? 'default' : 'pointer', fontFamily: SANS, opacity: pending ? 0.65 : 1 };
  const btnSec: CSSProperties = { ...btn, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)' };

  const hayLlamadas = llamadas.length > 0;
  const tieneFathom = ((lead.fathom_links ?? []) as FathomLink[]).some((f) => f.url?.trim());
  const puedeGenerar = !faltantes.length && hayLlamadas;
  const c = insight?.contenido;

  return (
    <>
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: c ? 14 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
            <span style={sectLabel}>Insights del lead</span>
          </div>
          {puedeGenerar && (
            <button type="button" onClick={generar} disabled={pending} style={btn}>
              {pending ? 'Analizando…' : insight ? 'Regenerar' : '✦ Generar insights'}
            </button>
          )}
        </div>

        {/* Bloqueo por datos faltantes de reuniones (posibles de completar). */}
        {faltantes.length > 0 && (
          <div style={{ ...mini, borderColor: 'var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: c ? 12 : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Para {insight ? 'regenerar' : 'generar'} faltan datos</div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{faltantes.map((f) => f.label).join(' · ')}</div>
            </div>
            <button type="button" onClick={() => setWizard(true)} style={btnSec}>Completar datos</button>
          </div>
        )}

        {/* Gate: sin llamadas analizadas linkeadas. Siempre se ofrece analizar/
            re-linkear: MaKo busca la llamada en Closing Analyst y Fathom por email
            o share_url (aunque el lead no tenga el link cargado). Si no la encuentra,
            el error se muestra abajo (nunca queda en silencio). */}
        {!insight && !hayLlamadas && !faltantes.length && !fase && (
          <div style={{ ...mini, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Se necesita al menos una llamada</div>
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>
                {tieneFathom
                  ? 'Este lead tiene el link de Fathom pero su llamada todavía no está analizada. MaKo la analiza y genera el insight.'
                  : 'MaKo busca la llamada en Closing Analyst y Fathom (por email o link) y la re-linkea a este lead. Si no la encuentra, cargá el link de Fathom.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={pedirAnalisis} disabled={pending} style={btn}>✦ Analizar la llamada</button>
              {!tieneFathom && <button type="button" onClick={() => setWizard(true)} style={btnSec}>Cargar link de Fathom</button>}
            </div>
          </div>
        )}

        {!insight && puedeGenerar && !error && (
          <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>
            Hay {llamadas.length} llamada{llamadas.length === 1 ? '' : 's'} analizada{llamadas.length === 1 ? '' : 's'}. Tocá <b>Generar</b> y MaKo devuelve la lectura comercial del lead.
          </p>
        )}
        {/* Error SIEMPRE visible (antes solo se mostraba con llamadas: los fallos
            del análisis/re-link quedaban invisibles). */}
        {error && !faltantes.length && !fase && <p style={{ fontSize: 13.5, color: 'var(--bad)', fontWeight: 600, marginTop: 10, marginBottom: 0 }}>{error}</p>}

        {/* Análisis (diseño scaneble) */}
        {c && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Próxima acción como titular */}
            {c.proxima_accion && (
              <div style={{ background: 'var(--accent-bg, #FBF3DE)', border: '1px solid #EBD9A8', borderRadius: 13, padding: '14px 16px' }}>
                <div style={{ ...miniLabel, color: 'var(--accent)', marginBottom: 5 }}>◆ Próxima mejor acción</div>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>{c.proxima_accion}</div>
              </div>
            )}

            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>{c.resumen}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              <div style={mini}>
                <div style={miniLabel}>Dolor principal</div>
                <div style={{ fontSize: 13.5, color: c.dolor ? 'var(--ink)' : 'var(--faint)', lineHeight: 1.5 }}>{c.dolor ?? '—'}</div>
              </div>
              <div style={mini}>
                <div style={miniLabel}>Situación del negocio</div>
                <div style={{ fontSize: 13.5, color: c.situacion ? 'var(--ink)' : 'var(--faint)', lineHeight: 1.5 }}>{c.situacion ?? '—'}</div>
              </div>
            </div>

            {(c.senales_compra.length > 0 || c.riesgos.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {c.senales_compra.length > 0 && (
                  <div style={mini}><div style={{ ...miniLabel, color: 'var(--good)' }}>Señales de compra</div><Chips items={c.senales_compra} tono="good" /></div>
                )}
                {c.riesgos.length > 0 && (
                  <div style={mini}><div style={{ ...miniLabel, color: 'var(--bad)' }}>Riesgos</div><Chips items={c.riesgos} tono="bad" /></div>
                )}
              </div>
            )}

            {c.objeciones.length > 0 && (
              <div style={mini}>
                <div style={miniLabel}>Objeciones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {c.objeciones.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: o.estado === 'resuelta' ? 'var(--good)' : 'var(--bad)', background: o.estado === 'resuelta' ? 'var(--good-bg)' : 'var(--bad-bg)' }}>{o.estado === 'resuelta' ? 'Resuelta' : 'Pendiente'}</span>
                      <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{o.texto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(c.preguntas.length > 0 || c.faltan_datos.length > 0) && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', listStyle: 'none' }}>Preguntas para la próxima llamada y cómo mejorar el análisis ▾</summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 10 }}>
                  {c.preguntas.length > 0 && (
                    <div style={mini}>
                      <div style={miniLabel}>Preguntas para la próxima llamada</div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>{c.preguntas.map((x, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{x}</li>)}</ul>
                    </div>
                  )}
                  {c.faltan_datos.length > 0 && (
                    <div style={mini}>
                      <div style={miniLabel}>Con esto el análisis mejora</div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>{c.faltan_datos.map((x, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.45 }}>{x}</li>)}</ul>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Footer: cuándo + llamadas base */}
            <div style={{ fontSize: 12, color: 'var(--faint)', borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {insight && <span>Generado el {fmtCuando(insight.created_at, tz)}</span>}
              <span>·</span>
              <span>Basado en {llamadas.length} llamada{llamadas.length === 1 ? '' : 's'}</span>
              {llamadas.filter((l) => l.url).map((l, i) => (
                <a key={i} href={l.url!} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>{l.tipo || 'Llamada'} ↗</a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Loader progresivo como pop-up (analizar/re-linkear → generar insight). */}
      {fase && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div role="dialog" aria-modal="true" aria-live="polite" style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '28px 26px', textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)', marginBottom: 16 }}>✦ MAKO</div>
            <span aria-hidden style={{ display: 'inline-block', width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{fase}</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8 }}>Puede tardar unos segundos. No cierres la ficha.</div>
          </div>
        </div>
      )}

      {wizard && (
        <StageMoveDialog
          lead={moveInfo}
          stages={stages}
          move={{ to: currentStage }}
          titulo="Completar datos"
          onClose={() => setWizard(false)}
          onDone={() => { setWizard(false); setFaltantes([]); router.refresh(); generar(); }}
        />
      )}

      {confirmAnalizar && (
        <ConfirmDialog
          title="Analizar la llamada"
          message={<>Este lead <b>no tiene su llamada analizada</b> en Closing Analyst. Voy a extraer los datos de Fathom, analizar el closing y generar el insight. ¿Ejecutar el proceso?</>}
          confirmLabel="Sí, ejecutar"
          onConfirm={confirmarYAnalizar}
          onCancel={() => setConfirmAnalizar(false)}
          zIndex={120}
        />
      )}
    </>
  );
}
