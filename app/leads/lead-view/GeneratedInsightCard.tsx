'use client';

// =============================================================================
// GeneratedInsightCard — análisis generativo del lead (✦ MaKo · Generar/Regenerar)
// =============================================================================
// Muestra el último análisis guardado y el botón Generar/Regenerar. Los
// requisitos se validan server-side (lib/lead-insights): si faltan datos
// completables se piden con el wizard conocido (StageMoveDialog apuntando a la
// etapa ACTUAL); si no hay ninguna señal sustantiva se explica qué falta.

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { deriveStageKey, type Stage } from '@/lib/pipeline';
import type { Lead, FathomLink } from '@/lib/leads';
import type { LeadInsightGen } from '@/lib/lead-insights';
import type { Step } from '@/lib/stage-requirements';
import { generateLeadInsightAction } from '../insights-actions';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const mini: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 16px' };
const miniLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 };

const fmtCuando = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Tijuana', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function Contenedor({ titulo, children, full }: { titulo: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ ...mini, gridColumn: full ? '1 / -1' : undefined }}>
      <div style={miniLabel}>{titulo}</div>
      {children}
    </div>
  );
}

function Lista({ items, vacio }: { items: string[]; vacio: string }) {
  if (!items.length) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>{vacio}</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((x, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{x}</li>)}
    </ul>
  );
}

export function GeneratedInsightCard({ lead, stages, tienePlan, inicial, faltantesIniciales, haySenales }: {
  lead: Lead;
  stages: Stage[];
  tienePlan: boolean;
  inicial: LeadInsightGen | null;
  /** Datos completables adeudados por la etapa actual (calculados server-side). */
  faltantesIniciales: Step[];
  /** true si ya hay respuestas de Calendly o llamadas analizadas (señal barata). */
  haySenales: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [insight, setInsight] = useState<LeadInsightGen | null>(inicial);
  const [faltantes, setFaltantes] = useState<Step[]>(faltantesIniciales);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);

  // Adopción de props: tras un router.refresh() el server manda inicial/faltantes
  // nuevos SIN remontar el componente — reset en render (patrón prev-key) para
  // que el estado local no quede viejo.
  const fpProps = `${inicial?.id ?? 0}|${faltantesIniciales.map((f) => f.id).join(',')}`;
  const [fpPrev, setFpPrev] = useState(fpProps);
  if (fpProps !== fpPrev) {
    setFpPrev(fpProps);
    setInsight(inicial);
    setFaltantes(faltantesIniciales);
  }
  // Sin señales baratas, el chat de WhatsApp puede habilitar igual (se chequea lazy).
  const [chatHabilita, setChatHabilita] = useState<boolean | null>(null);

  useEffect(() => {
    if (haySenales || insight || chatHabilita !== null) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/whatsapp/lead/${lead.id}`);
        const j = await r.json();
        if (vivo) setChatHabilita(!!j.ok && Array.isArray(j.mensajes) && j.mensajes.some((m: { texto?: string | null }) => m.texto?.trim()));
      } catch {
        if (vivo) setChatHabilita(false);
      }
    })();
    return () => { vivo = false; };
  }, [lead.id, haySenales, insight, chatHabilita]);

  const currentStage = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const moveInfo: MoveLeadInfo = {
    id: lead.id,
    name: lead.nombre,
    fechaJ1: lead.fecha_junta_1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ1: lead.asistio_j1,
    asistioJ2: lead.asistio_j2,
    calificado: lead.calificado,
    fathom: (lead.fathom_links ?? []) as FathomLink[],
    monto: lead.monto_cierre_usd ?? null,
    motivo: lead.motivo_perdida,
    setter: lead.setter ?? null,
    tienePlan,
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
  };

  const generar = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateLeadInsightAction(lead.id);
      if (res.ok) {
        setInsight(res.insight);
        setFaltantes([]);
        router.refresh();
      } else {
        if (res.faltantes?.length) setFaltantes(res.faltantes);
        setError(res.motivo);
      }
    });
  };

  const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: pending ? 'default' : 'pointer', fontFamily: SANS, opacity: pending ? 0.65 : 1 };
  const btnSec: CSSProperties = { ...btn, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)' };

  const senalesOk = haySenales || !!insight || chatHabilita === true;
  const chequeando = !haySenales && !insight && chatHabilita === null;
  const bloqueadoSinSenales = !insight && !faltantes.length && !haySenales && chatHabilita === false;
  const puedeGenerar = !faltantes.length && senalesOk;

  const c = insight?.contenido;

  return (
    <>
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: c ? 6 : 12 }}>
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

        {insight && (
          <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14 }}>
            Generado el {fmtCuando(insight.created_at)}
            {insight.fuentes && ` · fuentes: ${[
              insight.fuentes.llamadas ? `${insight.fuentes.llamadas} llamada(s)` : null,
              insight.fuentes.respuestasR1 || insight.fuentes.respuestasR2 ? 'forms de Calendly' : null,
              insight.fuentes.chat ? `chat (${insight.fuentes.chat} msjs)` : null,
              insight.fuentes.anuncio ? 'anuncio' : null,
              insight.fuentes.tracking ? 'tracking' : null,
              insight.fuentes.deal ? 'deal' : null,
            ].filter(Boolean).join(', ')}`}
          </div>
        )}

        {/* Bloqueos / avisos */}
        {faltantes.length > 0 && (
          <div style={{ ...mini, borderColor: 'var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: c ? 12 : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Para {insight ? 'regenerar' : 'generar'} faltan datos de las reuniones</div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{faltantes.map((f) => f.label).join(' · ')}</div>
            </div>
            <button type="button" onClick={() => setWizard(true)} style={btnSec}>Completar datos</button>
          </div>
        )}
        {bloqueadoSinSenales && (
          <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>
            No es posible generar insights todavía: no hay respuestas de Calendly, llamadas analizadas ni conversación de WhatsApp. Se habilita apenas el lead agende, conteste un mensaje o se analice una llamada.
          </p>
        )}
        {chequeando && !faltantes.length && (
          <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>Revisando qué datos hay disponibles…</p>
        )}
        {!insight && puedeGenerar && !error && (
          <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>
            Todavía no se generaron insights. MaKo junta reuniones, formularios, llamadas, chat, el anuncio de origen, el tracking y la cobranza, y devuelve una lectura comercial accionable.
          </p>
        )}
        {error && !faltantes.length && <p style={{ fontSize: 13.5, color: 'var(--bad)', fontWeight: 600, marginTop: 10, marginBottom: 0 }}>{error}</p>}

        {/* Análisis */}
        {c && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            <Contenedor titulo="Resumen" full>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.resumen}</div>
            </Contenedor>
            <Contenedor titulo="Dolor principal">
              <div style={{ fontSize: 13.5, color: c.dolor ? 'var(--ink)' : 'var(--faint)', lineHeight: 1.5 }}>{c.dolor ?? 'Sin señal todavía.'}</div>
            </Contenedor>
            <Contenedor titulo="Situación del negocio">
              <div style={{ fontSize: 13.5, color: c.situacion ? 'var(--ink)' : 'var(--faint)', lineHeight: 1.5 }}>{c.situacion ?? 'Sin señal todavía.'}</div>
            </Contenedor>
            <Contenedor titulo="Señales de compra">
              <Lista items={c.senales_compra} vacio="Sin señales detectadas." />
            </Contenedor>
            <Contenedor titulo="Riesgos">
              <Lista items={c.riesgos} vacio="Sin riesgos detectados." />
            </Contenedor>
            {c.objeciones.length > 0 && (
              <Contenedor titulo="Objeciones" full>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {c.objeciones.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: o.estado === 'resuelta' ? 'var(--good)' : 'var(--bad)', background: o.estado === 'resuelta' ? 'var(--good-bg)' : 'var(--bad-bg)' }}>
                        {o.estado === 'resuelta' ? 'Resuelta' : 'Pendiente'}
                      </span>
                      <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{o.texto}</span>
                    </div>
                  ))}
                </div>
              </Contenedor>
            )}
            {c.proxima_accion && (
              <Contenedor titulo="Próxima mejor acción" full>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{c.proxima_accion}</div>
              </Contenedor>
            )}
            {c.preguntas.length > 0 && (
              <Contenedor titulo="Preguntas para la próxima llamada" full>
                <Lista items={c.preguntas} vacio="" />
              </Contenedor>
            )}
            {c.faltan_datos.length > 0 && (
              <Contenedor titulo="Con esto el análisis mejora" full>
                <Lista items={c.faltan_datos} vacio="" />
              </Contenedor>
            )}
          </div>
        )}
      </section>

      {wizard && (
        <StageMoveDialog
          lead={moveInfo}
          stages={stages}
          move={{ to: currentStage }}
          titulo="Completar datos"
          onClose={() => setWizard(false)}
          onDone={() => {
            setWizard(false);
            setFaltantes([]);
            router.refresh();
            // Con los datos recién completados, generar directo (la action
            // revalida server-side; si aún falta algo, vuelve el aviso).
            generar();
          }}
        />
      )}
    </>
  );
}
